// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import {
  getOrCreateKey,
  encryptJSON,
  decryptJSON,
  isEncryptionSupported,
} from '../utils/encryption';
import { logger } from '@/utils/logger';

/**
 * Local Document Registry Service
 *
 * Tracks document metadata for files stored locally on solicitor/conveyancer systems.
 * Documents are stored on their GDPR-compliant local infrastructure.
 * Only hashes and metadata pointers are registered on-chain.
 *
 * This service provides a simple registry to track:
 * - Where documents are stored locally (user's responsibility)
 * - Hash verification data
 * - On-chain registration IDs
 *
 * SECURITY: Document metadata is encrypted using AES-GCM 256-bit before storing in IndexedDB.
 */

export interface LocalDocumentRecord {
  id: string;  // Local UUID
  blockchainId?: number;  // On-chain document ID (after registration)
  fileName: string;
  fileHash: string;  // SHA-256 hash
  fileSize: number;
  mimeType: string;
  localPath: string;  // User-defined path/reference to their local storage
  uploadedBy: string;  // Principal ID
  uploadedAt: string;  // ISO timestamp
  propertyId: number;
  transactionId?: string;
  documentType: string;
  verified: boolean;
  notes?: string;
}

/**
 * IndexedDB configuration for encrypted document registry storage
 */
const DB_CONFIG = {
  dbName: 'propxchain-document-registry',
  dbVersion: 1,
  storeName: 'encrypted-documents',
  registryKey: 'document-registry', // Single key for the entire registry array
  encryptionKeyName: 'document-registry-key', // Encryption key name
} as const;

/**
 * Local Document Registry
 *
 * Manages a local index of documents for quick lookup and verification.
 * Actual documents remain on solicitor's GDPR-compliant storage.
 *
 * All registry data is encrypted with AES-GCM 256-bit before storage in IndexedDB.
 */
class LocalDocumentRegistryService {
  private encryptionKey: CryptoKey | null = null;

  /**
   * Initialize encryption key (lazy loaded on first use)
   */
  private async ensureEncryptionKey(): Promise<CryptoKey> {
    if (this.encryptionKey) {
      return this.encryptionKey;
    }

    if (!isEncryptionSupported()) {
      throw new Error('Encryption not supported in this browser');
    }

    this.encryptionKey = await getOrCreateKey(DB_CONFIG.encryptionKeyName);
    return this.encryptionKey;
  }

  /**
   * Open IndexedDB connection for encrypted registry storage
   */
  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_CONFIG.dbName, DB_CONFIG.dbVersion);

      request.onerror = () => {
        logger.error('❌ Failed to open IndexedDB for document registry');
        reject(new Error('IndexedDB connection failed'));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(DB_CONFIG.storeName)) {
          db.createObjectStore(DB_CONFIG.storeName);
        }
      };
    });
  }

  /**
   * Register a document in the local index
   * Call this after the user selects a file and before registering hash on-chain
   */
  async registerDocument(record: Omit<LocalDocumentRecord, 'id'>): Promise<LocalDocumentRecord> {
    const id = this.generateId();
    const fullRecord: LocalDocumentRecord = { id, ...record };

    const registry = await this.getAllRecords();
    registry.push(fullRecord);
    await this.saveRegistry(registry);

    logger.info('Document registered locally (encrypted)', { id });

    return fullRecord;
  }

  /**
   * Update record with blockchain ID after on-chain registration
   */
  async updateBlockchainId(localId: string, blockchainId: number): Promise<boolean> {
    const registry = await this.getAllRecords();
    const index = registry.findIndex(r => r.id === localId);

    if (index === -1) return false;

    registry[index].blockchainId = blockchainId;
    await this.saveRegistry(registry);

    logger.info('🔗 Blockchain ID linked:', { localId, blockchainId });
    return true;
  }

  /**
   * Get document record by local ID
   */
  async getRecord(localId: string): Promise<LocalDocumentRecord | null> {
    const registry = await this.getAllRecords();
    return registry.find(r => r.id === localId) || null;
  }

  /**
   * Get document record by blockchain ID
   */
  async getRecordByBlockchainId(blockchainId: number): Promise<LocalDocumentRecord | null> {
    const registry = await this.getAllRecords();
    return registry.find(r => r.blockchainId === blockchainId) || null;
  }

  /**
   * Get all documents for a property
   */
  async getDocumentsForProperty(propertyId: number): Promise<LocalDocumentRecord[]> {
    const registry = await this.getAllRecords();
    return registry.filter(r => r.propertyId === propertyId);
  }

  /**
   * Get all documents for a transaction
   */
  async getDocumentsForTransaction(transactionId: string): Promise<LocalDocumentRecord[]> {
    const registry = await this.getAllRecords();
    return registry.filter(r => r.transactionId === transactionId);
  }

  /**
   * Mark document as verified
   */
  async markVerified(localId: string): Promise<boolean> {
    const registry = await this.getAllRecords();
    const index = registry.findIndex(r => r.id === localId);

    if (index === -1) return false;

    registry[index].verified = true;
    await this.saveRegistry(registry);
    return true;
  }

  /**
   * Remove document from local registry
   * Note: This removes the registry entry only.
   * User must delete actual file from their local storage for GDPR compliance.
   */
  async removeDocument(localId: string): Promise<{ success: boolean; localPath?: string }> {
    const registry = await this.getAllRecords();
    const index = registry.findIndex(r => r.id === localId);

    if (index === -1) return { success: false };

    const localPath = registry[index].localPath;
    registry.splice(index, 1);
    await this.saveRegistry(registry);

    logger.info('🗑️ Document removed from registry. GDPR: Delete local file at:', localPath);

    return { success: true, localPath };
  }

  /**
   * Get all records (decrypted from IndexedDB)
   */
  async getAllRecords(): Promise<LocalDocumentRecord[]> {
    try {
      const key = await this.ensureEncryptionKey();
      const db = await this.openDatabase();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([DB_CONFIG.storeName], 'readonly');
        const store = transaction.objectStore(DB_CONFIG.storeName);
        const request = store.get(DB_CONFIG.registryKey);

        request.onerror = () => {
          logger.error('❌ Failed to read encrypted registry from IndexedDB');
          reject(new Error('Failed to read registry'));
        };

        request.onsuccess = async () => {
          try {
            if (!request.result) {
              // No data yet, return empty array
              resolve([]);
              return;
            }

            // Decrypt the registry data
            const decrypted = await decryptJSON<LocalDocumentRecord[]>(
              request.result as ArrayBuffer,
              key
            );
            resolve(decrypted);
          } catch (error) {
            logger.error('❌ Failed to decrypt registry:', error);
            reject(new Error('Failed to decrypt registry - data may be corrupted'));
          }
        };
      });
    } catch (error) {
      logger.error('❌ Error reading encrypted document registry:', error);
      return [];
    }
  }

  /**
   * Clear entire registry (use with caution)
   */
  async clearRegistry(): Promise<void> {
    try {
      const db = await this.openDatabase();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([DB_CONFIG.storeName], 'readwrite');
        const store = transaction.objectStore(DB_CONFIG.storeName);
        const request = store.delete(DB_CONFIG.registryKey);

        request.onerror = () => {
          logger.error('❌ Failed to clear registry from IndexedDB');
          reject(new Error('Failed to clear registry'));
        };

        request.onsuccess = () => {
          logger.info('⚠️ Local document registry cleared (encrypted storage)');
          resolve();
        };
      });
    } catch (error) {
      logger.error('❌ Error clearing registry:', error);
      throw new Error('Failed to clear registry');
    }
  }

  /**
   * Export registry for backup (decrypted)
   */
  async exportRegistry(): Promise<string> {
    const registry = await this.getAllRecords();
    return JSON.stringify(registry, null, 2);
  }

  /**
   * Import registry from backup
   */
  async importRegistry(jsonData: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonData);
      if (!Array.isArray(data)) throw new Error('Invalid registry format');
      await this.saveRegistry(data);
      return true;
    } catch (error) {
      logger.error('❌ Error importing registry:', error);
      return false;
    }
  }

  /**
   * Generate storage location URI for on-chain registration
   * This creates a reference to the local file path
   */
  generateStorageLocation(localPath: string): string {
    // Format: local://<encoded-path>
    // This is just a reference string, not actual storage
    return `local://${encodeURIComponent(localPath)}`;
  }

  /**
   * Get statistics about local registry
   */
  async getStats(): Promise<{
    totalDocuments: number;
    verifiedDocuments: number;
    registeredOnChain: number;
    byPropertyCount: Record<number, number>;
  }> {
    const registry = await this.getAllRecords();
    const stats = {
      totalDocuments: registry.length,
      verifiedDocuments: registry.filter(r => r.verified).length,
      registeredOnChain: registry.filter(r => r.blockchainId !== undefined).length,
      byPropertyCount: {} as Record<number, number>
    };

    registry.forEach(r => {
      stats.byPropertyCount[r.propertyId] = (stats.byPropertyCount[r.propertyId] || 0) + 1;
    });

    return stats;
  }

  // Private helpers

  /**
   * Save registry to encrypted IndexedDB storage
   */
  private async saveRegistry(registry: LocalDocumentRecord[]): Promise<void> {
    try {
      const key = await this.ensureEncryptionKey();
      const db = await this.openDatabase();

      // Encrypt the entire registry array
      const encrypted = await encryptJSON(registry, key);

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([DB_CONFIG.storeName], 'readwrite');
        const store = transaction.objectStore(DB_CONFIG.storeName);
        const request = store.put(encrypted, DB_CONFIG.registryKey);

        request.onerror = () => {
          logger.error('❌ Failed to save encrypted registry to IndexedDB');
          reject(new Error('Failed to save registry'));
        };

        request.onsuccess = () => {
          resolve();
        };
      });
    } catch (error) {
      logger.error('❌ Error saving encrypted registry:', error);
      throw new Error('Failed to save encrypted registry');
    }
  }

  private generateId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

export const localDocumentRegistry = new LocalDocumentRegistryService();
export default localDocumentRegistry;
