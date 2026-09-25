/**
 * Web2 Document Service
 *
 * Handles GDPR-compliant document storage for Web2 users:
 * - Files stored locally in IndexedDB (never uploaded to cloud)
 * - Only SHA-256 hashes stored in Supabase database
 * - Supports firm/client document namespacing
 */

import { logger } from '@/utils/logger';
import { apiService } from './api.service';

// IndexedDB database name and store
const DB_NAME = 'propxchain_documents';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

// localStorage key for document metadata
const METADATA_KEY = 'web2_documents';

export interface DocumentMetadata {
  id: string;
  transactionId: string;
  documentType: string;
  fileName: string;
  fileHash: string;
  fileSize: number;
  contentType: string;
  storageLocation: string;
  uploadedAt: string;
  uploadedBy: string;
  firmId?: string;
  verified: boolean;
  aiVerification?: {
    isValid: boolean;
    confidence: number;
    verifiedAt: string;
    provider: string;
  };
}

export interface StoredDocument {
  id: string;
  transactionId: string;
  documentType: string;
  fileName: string;
  fileData: ArrayBuffer;
  contentType: string;
  uploadedAt: string;
}

class Web2DocumentService {
  private db: IDBDatabase | null = null;
  private dbReady: Promise<void>;

  constructor() {
    this.dbReady = this.initDB();
  }

  /**
   * Initialize IndexedDB
   */
  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        logger.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        logger.info('IndexedDB initialized for document storage');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create document store with indexes
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('transactionId', 'transactionId', { unique: false });
          store.createIndex('documentType', 'documentType', { unique: false });
          store.createIndex('firmId', 'firmId', { unique: false });
        }
      };
    });
  }

  /**
   * Generate SHA-256 hash of a file
   */
  async generateFileHash(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate unique document ID
   */
  private generateDocumentId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Store a document locally (IndexedDB) and register hash with API
   */
  async uploadDocument(
    file: File,
    transactionId: string,
    documentType: string,
    options: {
      firmId?: string;
      uploadedBy?: string;
      registerWithApi?: boolean;
    } = {}
  ): Promise<DocumentMetadata> {
    await this.dbReady;

    const { firmId, uploadedBy, registerWithApi = true } = options;

    // Generate hash (file stays local, only hash goes to server)
    const fileHash = await this.generateFileHash(file);
    const documentId = this.generateDocumentId();
    const storageLocation = `indexeddb://${DB_NAME}/${documentId}`;

    // Store file in IndexedDB
    const fileData = await file.arrayBuffer();
    const storedDocument: StoredDocument = {
      id: documentId,
      transactionId,
      documentType,
      fileName: file.name,
      fileData,
      contentType: file.type,
      uploadedAt: new Date().toISOString(),
    };

    await this.storeInIndexedDB(storedDocument);

    // Create metadata
    const metadata: DocumentMetadata = {
      id: documentId,
      transactionId,
      documentType,
      fileName: file.name,
      fileHash,
      fileSize: file.size,
      contentType: file.type,
      storageLocation,
      uploadedAt: new Date().toISOString(),
      uploadedBy: uploadedBy || localStorage.getItem('userId') || 'unknown',
      firmId,
      verified: false,
    };

    // Store metadata in localStorage
    this.saveMetadataToLocalStorage(metadata);

    // Register hash with API (if enabled)
    if (registerWithApi) {
      try {
        await apiService.post(`/api/documents/${transactionId}/hash`, {
          documentType,
          fileName: file.name,
          fileHash,
          fileSize: file.size,
          contentType: file.type,
          storageLocation,
        }, true);
        logger.info(`Document hash registered with API: ${documentId}`);
      } catch (error) {
        logger.warn('Failed to register hash with API (offline mode):', error);
        // Continue - document is stored locally, can sync later
      }
    }

    logger.info(`Document stored locally: ${documentId} (${file.name})`);
    return metadata;
  }

  /**
   * Store document in IndexedDB
   */
  private async storeInIndexedDB(document: StoredDocument): Promise<void> {
    await this.dbReady;

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(document);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Retrieve document from IndexedDB
   */
  async getDocument(documentId: string): Promise<StoredDocument | null> {
    await this.dbReady;

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(documentId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  /**
   * Get all documents for a transaction
   */
  async getDocumentsByTransaction(transactionId: string): Promise<StoredDocument[]> {
    await this.dbReady;

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('transactionId');
      const request = index.getAll(transactionId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  /**
   * Get all documents for a firm
   */
  async getDocumentsByFirm(firmId: string): Promise<DocumentMetadata[]> {
    const allMetadata = this.getAllMetadataFromLocalStorage();
    return allMetadata.filter(doc => doc.firmId === firmId);
  }

  /**
   * Delete document from IndexedDB and metadata
   */
  async deleteDocument(documentId: string): Promise<void> {
    await this.dbReady;

    // Delete from IndexedDB
    await new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(documentId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });

    // Delete from localStorage metadata
    this.deleteMetadataFromLocalStorage(documentId);

    // Try to delete from API
    try {
      await apiService.delete(`/api/documents/${documentId}`, true);
    } catch (error) {
      logger.warn('Failed to delete from API:', error);
    }

    logger.info(`Document deleted: ${documentId}`);
  }

  /**
   * Verify document hash matches stored hash
   */
  async verifyDocumentHash(documentId: string): Promise<boolean> {
    const metadata = this.getMetadataFromLocalStorage(documentId);
    if (!metadata) {
      throw new Error('Document metadata not found');
    }

    const storedDocument = await this.getDocument(documentId);
    if (!storedDocument) {
      throw new Error('Document not found in local storage');
    }

    // Generate hash from stored file
    const hashBuffer = await crypto.subtle.digest('SHA-256', storedDocument.fileData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const currentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Compare with stored hash
    return currentHash === metadata.fileHash;
  }

  /**
   * Download document as blob
   */
  async downloadDocument(documentId: string): Promise<Blob | null> {
    const storedDocument = await this.getDocument(documentId);
    if (!storedDocument) {
      return null;
    }

    return new Blob([storedDocument.fileData], { type: storedDocument.contentType });
  }

  /**
   * Get document as data URL (for preview)
   */
  async getDocumentDataUrl(documentId: string): Promise<string | null> {
    const blob = await this.downloadDocument(documentId);
    if (!blob) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  // ==================== LocalStorage Metadata Management ====================

  /**
   * Save metadata to localStorage
   */
  private saveMetadataToLocalStorage(metadata: DocumentMetadata): void {
    const allMetadata = this.getAllMetadataFromLocalStorage();
    const existingIndex = allMetadata.findIndex(m => m.id === metadata.id);

    if (existingIndex >= 0) {
      allMetadata[existingIndex] = metadata;
    } else {
      allMetadata.push(metadata);
    }

    localStorage.setItem(METADATA_KEY, JSON.stringify(allMetadata));
  }

  /**
   * Get all metadata from localStorage
   */
  getAllMetadataFromLocalStorage(): DocumentMetadata[] {
    const stored = localStorage.getItem(METADATA_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  /**
   * Get metadata for a specific document
   */
  getMetadataFromLocalStorage(documentId: string): DocumentMetadata | null {
    const allMetadata = this.getAllMetadataFromLocalStorage();
    return allMetadata.find(m => m.id === documentId) || null;
  }

  /**
   * Get metadata for a transaction
   */
  getMetadataByTransaction(transactionId: string): DocumentMetadata[] {
    const allMetadata = this.getAllMetadataFromLocalStorage();
    return allMetadata.filter(m => m.transactionId === transactionId);
  }

  /**
   * Delete metadata from localStorage
   */
  private deleteMetadataFromLocalStorage(documentId: string): void {
    const allMetadata = this.getAllMetadataFromLocalStorage();
    const filtered = allMetadata.filter(m => m.id !== documentId);
    localStorage.setItem(METADATA_KEY, JSON.stringify(filtered));
  }

  /**
   * Update metadata (e.g., after AI verification)
   */
  updateMetadata(documentId: string, updates: Partial<DocumentMetadata>): void {
    const metadata = this.getMetadataFromLocalStorage(documentId);
    if (metadata) {
      this.saveMetadataToLocalStorage({ ...metadata, ...updates });
    }
  }

  // ==================== Firm-Specific Document Management ====================

  /**
   * Get storage statistics for a firm
   */
  async getFirmStorageStats(firmId: string): Promise<{
    totalDocuments: number;
    totalSize: number;
    byType: Record<string, number>;
  }> {
    const firmDocs = await this.getDocumentsByFirm(firmId);
    const byType: Record<string, number> = {};
    let totalSize = 0;

    for (const doc of firmDocs) {
      totalSize += doc.fileSize;
      byType[doc.documentType] = (byType[doc.documentType] || 0) + 1;
    }

    return {
      totalDocuments: firmDocs.length,
      totalSize,
      byType,
    };
  }

  /**
   * Sync local documents with API (for offline-first scenarios)
   */
  async syncWithApi(): Promise<{ synced: number; failed: number }> {
    const allMetadata = this.getAllMetadataFromLocalStorage();
    let synced = 0;
    let failed = 0;

    for (const metadata of allMetadata) {
      try {
        await apiService.post(`/api/documents/${metadata.transactionId}/hash`, {
          documentType: metadata.documentType,
          fileName: metadata.fileName,
          fileHash: metadata.fileHash,
          fileSize: metadata.fileSize,
          contentType: metadata.contentType,
          storageLocation: metadata.storageLocation,
        }, true);
        synced++;
      } catch (error) {
        logger.warn(`Failed to sync document ${metadata.id}:`, error);
        failed++;
      }
    }

    logger.info(`Document sync complete: ${synced} synced, ${failed} failed`);
    return { synced, failed };
  }

  /**
   * Clear all local documents (use with caution)
   */
  async clearAllDocuments(): Promise<void> {
    await this.dbReady;

    // Clear IndexedDB
    await new Promise<void>((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });

    // Clear localStorage
    localStorage.removeItem(METADATA_KEY);

    logger.info('All local documents cleared');
  }
}

// Export singleton instance
export const web2DocumentService = new Web2DocumentService();
export default web2DocumentService;
