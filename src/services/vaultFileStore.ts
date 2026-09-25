// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Vault File Store
 *
 * The encrypted local blob store behind the "My Documents" vault. Plaintext
 * file bytes are AES-GCM-256 encrypted and kept in IndexedDB, keyed by the
 * local registry record id. This is what makes the vault's "saved locally"
 * promise real — localDocumentRegistry holds only metadata, not the file.
 * Nothing here ever leaves the browser.
 *
 * @deprecated Read-only since 2026-08-18 — kept only so vaultMigration.service can
 * move legacy device-local files into account storage. Do not write to it.
 */
import {
  getOrCreateKey,
  encryptData,
  decryptData,
  isEncryptionSupported,
} from '../utils/encryption';

const DB_CONFIG = {
  dbName: 'propxchain-vault-files',
  dbVersion: 1,
  storeName: 'files',
  encryptionKeyName: 'vault-file-key',
} as const;

interface StoredFile {
  localId: string;
  /** IV-prepended AES-GCM ciphertext (from encryptData). */
  ciphertext: ArrayBuffer;
  fileName: string;
  mimeType: string;
}

export interface VaultFile {
  blob: Blob;
  fileName: string;
}

class VaultFileStore {
  private async open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_CONFIG.dbName, DB_CONFIG.dbVersion);
      request.onerror = () =>
        reject(new Error('Vault file store: IndexedDB connection failed'));
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(DB_CONFIG.storeName)) {
          db.createObjectStore(DB_CONFIG.storeName, { keyPath: 'localId' });
        }
      };
    });
  }

  /** Encrypt and store the file bytes, keyed by the registry record id. */
  async putFile(localId: string, file: File): Promise<void> {
    if (!isEncryptionSupported()) {
      throw new Error(
        'This browser cannot store documents securely (Web Crypto / IndexedDB unavailable).',
      );
    }
    const key = await getOrCreateKey(DB_CONFIG.encryptionKeyName);
    const plaintext = await file.arrayBuffer();
    const ciphertext = await encryptData(plaintext, key);
    const record: StoredFile = {
      localId,
      ciphertext,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
    };
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([DB_CONFIG.storeName], 'readwrite');
      tx.objectStore(DB_CONFIG.storeName).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error('Vault file store: failed to save file'));
    });
  }

  /** Decrypt and return the file as a Blob, or null if not present. */
  async getFile(localId: string): Promise<VaultFile | null> {
    const db = await this.open();
    const record = await new Promise<StoredFile | undefined>((resolve, reject) => {
      const tx = db.transaction([DB_CONFIG.storeName], 'readonly');
      const request = tx.objectStore(DB_CONFIG.storeName).get(localId);
      request.onsuccess = () => resolve(request.result as StoredFile | undefined);
      request.onerror = () => reject(new Error('Vault file store: failed to read file'));
    });
    if (!record) return null;
    const key = await getOrCreateKey(DB_CONFIG.encryptionKeyName);
    const plaintext = await decryptData(record.ciphertext, key);
    return {
      blob: new Blob([plaintext], { type: record.mimeType }),
      fileName: record.fileName,
    };
  }

  /** Delete the stored bytes for a record. No-op if absent. */
  async deleteFile(localId: string): Promise<void> {
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([DB_CONFIG.storeName], 'readwrite');
      tx.objectStore(DB_CONFIG.storeName).delete(localId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error('Vault file store: failed to delete file'));
    });
  }
}

export const vaultFileStore = new VaultFileStore();
export default vaultFileStore;
