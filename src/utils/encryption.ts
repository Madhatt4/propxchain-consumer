// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Web Crypto API Encryption Utilities for IndexedDB
 *
 * Provides secure client-side encryption for sensitive document metadata
 * stored in IndexedDB using native browser Web Crypto API (AES-GCM 256-bit).
 *
 * Security Features:
 * - AES-GCM authenticated encryption (prevents tampering)
 * - 256-bit encryption keys
 * - Random initialization vectors (IV) for each encryption
 * - CryptoKey objects stored in IndexedDB (opaque, not extractable to localStorage)
 * - No external crypto libraries required (native browser API)
 *
 * IMPORTANT: This is client-side encryption for browser storage protection.
 * It protects against local storage access but NOT against compromised client code.
 * Server-side encryption is still required for production data-at-rest protection.
 *
 * @example
 * ```typescript
 * // Generate and store encryption key
 * const key = await generateEncryptionKey();
 * await storeKeyInIndexedDB(key, 'myEncryptionKey');
 *
 * // Encrypt data
 * const plaintext = new TextEncoder().encode('Sensitive document metadata');
 * const encrypted = await encryptData(plaintext, key);
 *
 * // Decrypt data
 * const decrypted = await decryptData(encrypted, key);
 * const originalText = new TextDecoder().decode(decrypted);
 * ```
 */

import { logger } from './logger';

/**
 * Algorithm configuration for AES-GCM encryption
 */
const ENCRYPTION_ALGORITHM = {
  name: 'AES-GCM',
  length: 256, // 256-bit key
} as const;

/**
 * IV (Initialization Vector) length in bytes
 * AES-GCM standard uses 12-byte (96-bit) IVs
 */
const IV_LENGTH = 12;

/**
 * IndexedDB configuration for key storage
 */
const KEY_STORE_CONFIG = {
  dbName: 'propxchain-crypto-keys',
  dbVersion: 1,
  storeName: 'encryption-keys',
} as const;

/**
 * Generate a new AES-GCM 256-bit encryption key
 *
 * The generated key is a CryptoKey object that can be stored in IndexedDB.
 * It is marked as extractable (true) to allow import/export for IndexedDB storage,
 * but should NEVER be stored in localStorage (use IndexedDB only).
 *
 * @returns Promise<CryptoKey> - Generated encryption key
 * @throws Error if key generation fails
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
  try {
    const key = await crypto.subtle.generateKey(
      ENCRYPTION_ALGORITHM,
      true, // extractable (required for IndexedDB storage)
      ['encrypt', 'decrypt'] // key usages
    );
    return key;
  } catch (error) {
    logger.error('❌ Failed to generate encryption key:', error);
    throw new Error('Encryption key generation failed');
  }
}

/**
 * Encrypt data using AES-GCM with a random IV
 *
 * The IV is prepended to the encrypted data for later decryption.
 * Format: [12-byte IV][encrypted data]
 *
 * AES-GCM provides both confidentiality and authenticity (AEAD cipher).
 * Tampering with the encrypted data will be detected during decryption.
 *
 * @param data - Data to encrypt (as ArrayBuffer)
 * @param key - AES-GCM encryption key
 * @returns Promise<ArrayBuffer> - Encrypted data with IV prepended
 * @throws Error if encryption fails
 */
export async function encryptData(data: ArrayBuffer, key: CryptoKey): Promise<ArrayBuffer> {
  try {
    // Generate random IV (must be unique for each encryption)
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    // Encrypt data with AES-GCM
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    // Prepend IV to encrypted data (needed for decryption)
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encrypted), iv.length);

    return result.buffer;
  } catch (error) {
    logger.error('❌ Encryption failed:', error);
    throw new Error('Data encryption failed');
  }
}

/**
 * Decrypt data encrypted with encryptData()
 *
 * Extracts the IV from the first 12 bytes of the encrypted data,
 * then uses it to decrypt the remaining bytes.
 *
 * AES-GCM will throw an error if the data has been tampered with
 * (authentication tag verification fails).
 *
 * @param encryptedData - Encrypted data with IV prepended (from encryptData)
 * @param key - AES-GCM decryption key (same key used for encryption)
 * @returns Promise<ArrayBuffer> - Decrypted plaintext data
 * @throws Error if decryption fails or data is tampered
 */
export async function decryptData(encryptedData: ArrayBuffer, key: CryptoKey): Promise<ArrayBuffer> {
  try {
    const data = new Uint8Array(encryptedData);

    // Extract IV from first 12 bytes
    const iv = data.slice(0, IV_LENGTH);

    // Remaining bytes are the encrypted data
    const encryptedBytes = data.slice(IV_LENGTH);

    // Decrypt using AES-GCM
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedBytes
    );

    return decrypted;
  } catch (error) {
    logger.error('❌ Decryption failed (data may be corrupted or tampered):', error);
    throw new Error('Data decryption failed - data may be corrupted or tampered');
  }
}

/**
 * Encrypt a string (convenience wrapper for text data)
 *
 * @param plaintext - String to encrypt
 * @param key - AES-GCM encryption key
 * @returns Promise<ArrayBuffer> - Encrypted data with IV prepended
 */
export async function encryptString(plaintext: string, key: CryptoKey): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  return encryptData(data.buffer, key);
}

/**
 * Decrypt to a string (convenience wrapper for text data)
 *
 * @param encryptedData - Encrypted data with IV prepended
 * @param key - AES-GCM decryption key
 * @returns Promise<string> - Decrypted plaintext string
 */
export async function decryptString(encryptedData: ArrayBuffer, key: CryptoKey): Promise<string> {
  const decrypted = await decryptData(encryptedData, key);
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Encrypt a JSON object (convenience wrapper for structured data)
 *
 * @param obj - Object to encrypt (will be JSON.stringify'd)
 * @param key - AES-GCM encryption key
 * @returns Promise<ArrayBuffer> - Encrypted JSON data with IV prepended
 */
export async function encryptJSON<T>(obj: T, key: CryptoKey): Promise<ArrayBuffer> {
  const json = JSON.stringify(obj);
  return encryptString(json, key);
}

/**
 * Decrypt JSON object (convenience wrapper for structured data)
 *
 * @param encryptedData - Encrypted JSON data with IV prepended
 * @param key - AES-GCM decryption key
 * @returns Promise<T> - Decrypted and parsed JSON object
 */
export async function decryptJSON<T>(encryptedData: ArrayBuffer, key: CryptoKey): Promise<T> {
  const json = await decryptString(encryptedData, key);
  return JSON.parse(json) as T;
}

/**
 * Export a CryptoKey to raw format (for IndexedDB storage)
 *
 * @param key - CryptoKey to export
 * @returns Promise<ArrayBuffer> - Raw key bytes
 * @throws Error if key export fails
 */
export async function exportKey(key: CryptoKey): Promise<ArrayBuffer> {
  try {
    return await crypto.subtle.exportKey('raw', key);
  } catch (error) {
    logger.error('❌ Key export failed:', error);
    throw new Error('Failed to export encryption key');
  }
}

/**
 * Import a raw key from ArrayBuffer (for retrieving from IndexedDB)
 *
 * @param rawKey - Raw key bytes (from exportKey)
 * @returns Promise<CryptoKey> - Imported CryptoKey object
 * @throws Error if key import fails
 */
export async function importKey(rawKey: ArrayBuffer): Promise<CryptoKey> {
  try {
    return await crypto.subtle.importKey(
      'raw',
      rawKey,
      ENCRYPTION_ALGORITHM,
      true, // extractable
      ['encrypt', 'decrypt']
    );
  } catch (error) {
    logger.error('❌ Key import failed:', error);
    throw new Error('Failed to import encryption key');
  }
}

/**
 * Open IndexedDB connection for key storage
 *
 * @returns Promise<IDBDatabase> - IndexedDB database connection
 * @throws Error if database connection fails
 */
async function openKeyDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(KEY_STORE_CONFIG.dbName, KEY_STORE_CONFIG.dbVersion);

    request.onerror = () => {
      logger.error('❌ Failed to open IndexedDB for key storage');
      reject(new Error('IndexedDB connection failed'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(KEY_STORE_CONFIG.storeName)) {
        db.createObjectStore(KEY_STORE_CONFIG.storeName);
      }
    };
  });
}

/**
 * Store a CryptoKey in IndexedDB
 *
 * This is the ONLY secure way to store encryption keys in the browser.
 * NEVER store CryptoKey objects or raw keys in localStorage (not secure).
 *
 * @param key - CryptoKey to store
 * @param keyName - Unique name for the key (used as IndexedDB key)
 * @returns Promise<void>
 * @throws Error if storage fails
 */
export async function storeKeyInIndexedDB(key: CryptoKey, keyName: string): Promise<void> {
  try {
    const rawKey = await exportKey(key);
    const db = await openKeyDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([KEY_STORE_CONFIG.storeName], 'readwrite');
      const store = transaction.objectStore(KEY_STORE_CONFIG.storeName);
      const request = store.put(rawKey, keyName);

      request.onerror = () => {
        logger.error('❌ Failed to store encryption key in IndexedDB');
        reject(new Error('Key storage failed'));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  } catch (error) {
    logger.error('❌ Error storing key in IndexedDB:', error);
    throw new Error('Failed to store encryption key');
  }
}

/**
 * Retrieve a CryptoKey from IndexedDB
 *
 * @param keyName - Name of the key to retrieve
 * @returns Promise<CryptoKey | null> - Retrieved CryptoKey or null if not found
 * @throws Error if retrieval fails
 */
export async function getKeyFromIndexedDB(keyName: string): Promise<CryptoKey | null> {
  try {
    const db = await openKeyDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([KEY_STORE_CONFIG.storeName], 'readonly');
      const store = transaction.objectStore(KEY_STORE_CONFIG.storeName);
      const request = store.get(keyName);

      request.onerror = () => {
        logger.error('❌ Failed to retrieve encryption key from IndexedDB');
        reject(new Error('Key retrieval failed'));
      };

      request.onsuccess = async () => {
        if (!request.result) {
          resolve(null);
          return;
        }

        try {
          const key = await importKey(request.result as ArrayBuffer);
          resolve(key);
        } catch (error) {
          logger.error('❌ Failed to import retrieved key:', error);
          reject(new Error('Key import failed'));
        }
      };
    });
  } catch (error) {
    logger.error('❌ Error retrieving key from IndexedDB:', error);
    throw new Error('Failed to retrieve encryption key');
  }
}

/**
 * Delete a CryptoKey from IndexedDB
 *
 * @param keyName - Name of the key to delete
 * @returns Promise<void>
 * @throws Error if deletion fails
 */
export async function deleteKeyFromIndexedDB(keyName: string): Promise<void> {
  try {
    const db = await openKeyDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([KEY_STORE_CONFIG.storeName], 'readwrite');
      const store = transaction.objectStore(KEY_STORE_CONFIG.storeName);
      const request = store.delete(keyName);

      request.onerror = () => {
        logger.error('❌ Failed to delete encryption key from IndexedDB');
        reject(new Error('Key deletion failed'));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  } catch (error) {
    logger.error('❌ Error deleting key from IndexedDB:', error);
    throw new Error('Failed to delete encryption key');
  }
}

/**
 * Check if an encryption key exists in IndexedDB
 *
 * @param keyName - Name of the key to check
 * @returns Promise<boolean> - True if key exists, false otherwise
 */
export async function keyExistsInIndexedDB(keyName: string): Promise<boolean> {
  try {
    const key = await getKeyFromIndexedDB(keyName);
    return key !== null;
  } catch (error) {
    logger.error('❌ Error checking key existence:', error);
    return false;
  }
}

/**
 * Get or create an encryption key from IndexedDB
 *
 * Convenience function that retrieves an existing key or generates a new one
 * if it doesn't exist.
 *
 * @param keyName - Name of the key
 * @returns Promise<CryptoKey> - Existing or newly generated key
 */
export async function getOrCreateKey(keyName: string): Promise<CryptoKey> {
  try {
    // Try to retrieve existing key
    const existingKey = await getKeyFromIndexedDB(keyName);
    if (existingKey) {
      return existingKey;
    }

    // Generate new key if not found
    const newKey = await generateEncryptionKey();
    await storeKeyInIndexedDB(newKey, keyName);

    return newKey;
  } catch (error) {
    logger.error('❌ Error getting or creating key:', error);
    throw new Error('Failed to get or create encryption key');
  }
}

/**
 * Clear all encryption keys from IndexedDB
 *
 * WARNING: This will permanently delete all stored encryption keys.
 * Any data encrypted with these keys will become unrecoverable.
 *
 * @returns Promise<void>
 */
export async function clearAllKeys(): Promise<void> {
  try {
    const db = await openKeyDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([KEY_STORE_CONFIG.storeName], 'readwrite');
      const store = transaction.objectStore(KEY_STORE_CONFIG.storeName);
      const request = store.clear();

      request.onerror = () => {
        logger.error('❌ Failed to clear encryption keys from IndexedDB');
        reject(new Error('Failed to clear keys'));
      };

      request.onsuccess = () => {
        logger.info('🧹 All encryption keys cleared from IndexedDB');
        resolve();
      };
    });
  } catch (error) {
    logger.error('❌ Error clearing keys from IndexedDB:', error);
    throw new Error('Failed to clear encryption keys');
  }
}

/**
 * Validate that Web Crypto API is available in the browser
 *
 * @returns boolean - True if Web Crypto API is available
 */
export function isCryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
}

/**
 * Validate that IndexedDB is available in the browser
 *
 * @returns boolean - True if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

/**
 * Check if encryption is supported in the current browser environment
 *
 * @returns boolean - True if both Web Crypto API and IndexedDB are available
 */
export function isEncryptionSupported(): boolean {
  return isCryptoAvailable() && isIndexedDBAvailable();
}
