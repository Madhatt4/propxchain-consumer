// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Hash Generation Utility for PropXchain
 *
 * Generates SHA-256 hashes for documents to be stored on-chain.
 * Actual document content stays local, only hash goes to blockchain.
 */

/**
 * Generate SHA-256 hash of a file
 * @param file - The file to hash
 * @returns Promise<string> - 64-character hex hash
 */
export async function generateFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Verify that a file matches an expected hash
 * @param file - The file to verify
 * @param expectedHash - The expected SHA-256 hash (64 hex characters)
 * @returns Promise<boolean> - true if hash matches, false otherwise
 */
export async function verifyFileHash(file: File, expectedHash: string): Promise<boolean> {
  const actualHash = await generateFileHash(file);
  return actualHash.toLowerCase() === expectedHash.toLowerCase();
}

/**
 * Generate hash from ArrayBuffer (useful for already-loaded content)
 * @param buffer - ArrayBuffer of file content
 * @returns Promise<string> - 64-character hex hash
 */
export async function generateBufferHash(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Validate that a string is a valid SHA-256 hash format
 * @param hash - String to validate
 * @returns boolean - true if valid SHA-256 format
 */
export function isValidSHA256Hash(hash: string): boolean {
  if (hash.length !== 64) return false;
  return /^[a-fA-F0-9]{64}$/.test(hash);
}

/**
 * Create a fingerprint object for document identification
 * Contains hash and metadata for quick comparison
 */
export interface DocumentFingerprint {
  hash: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

/**
 * Generate a complete document fingerprint
 * @param file - The file to fingerprint
 * @returns Promise<DocumentFingerprint>
 */
export async function generateDocumentFingerprint(file: File): Promise<DocumentFingerprint> {
  const hash = await generateFileHash(file);
  return {
    hash,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || 'application/octet-stream',
    createdAt: new Date().toISOString()
  };
}

/**
 * Compare two document fingerprints
 * @param fp1 - First fingerprint
 * @param fp2 - Second fingerprint
 * @returns boolean - true if fingerprints match
 */
export function compareFingerprints(fp1: DocumentFingerprint, fp2: DocumentFingerprint): boolean {
  return fp1.hash === fp2.hash &&
         fp1.fileSize === fp2.fileSize &&
         fp1.mimeType === fp2.mimeType;
}
