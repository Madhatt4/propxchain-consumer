// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { logger } from '@/utils/logger';

const STORAGE_KEY = 'propxchain_acknowledged_docs';

/**
 * Structure for storing acknowledged documents per transaction
 */
interface AcknowledgedDocuments {
  [transactionId: string]: {
    documentIds: string[];
    lastAcknowledgedAt: number;
  };
}

/**
 * Get all acknowledged documents from localStorage
 */
export function getAcknowledgedDocuments(): AcknowledgedDocuments {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Save acknowledged documents to localStorage
 */
function saveAcknowledgedDocuments(data: AcknowledgedDocuments): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    logger.error('Failed to save acknowledged documents:', error);
  }
}

/**
 * Mark a single document as acknowledged/seen
 * @param transactionId - The transaction this document belongs to
 * @param documentId - The document ID to acknowledge (as string for consistency)
 */
export function acknowledgeDocument(transactionId: string, documentId: string): void {
  const acknowledged = getAcknowledgedDocuments();

  if (!acknowledged[transactionId]) {
    acknowledged[transactionId] = { documentIds: [], lastAcknowledgedAt: Date.now() };
  }

  const docIdStr = String(documentId);
  if (!acknowledged[transactionId].documentIds.includes(docIdStr)) {
    acknowledged[transactionId].documentIds.push(docIdStr);
    acknowledged[transactionId].lastAcknowledgedAt = Date.now();
    saveAcknowledgedDocuments(acknowledged);
  }
}

/**
 * Mark all documents for a transaction as acknowledged
 * @param transactionId - The transaction ID
 * @param documentIds - Array of document IDs to acknowledge
 */
export function acknowledgeAllDocuments(transactionId: string, documentIds: (string | number | bigint)[]): void {
  const acknowledged = getAcknowledgedDocuments();

  acknowledged[transactionId] = {
    documentIds: documentIds.map(id => String(id)),
    lastAcknowledgedAt: Date.now(),
  };

  saveAcknowledgedDocuments(acknowledged);
}

/**
 * Check if a specific document is new (not yet acknowledged)
 * @param transactionId - The transaction this document belongs to
 * @param documentId - The document ID to check
 * @returns true if document has NOT been acknowledged (is new)
 */
export function isNewDocument(transactionId: string, documentId: string | number | bigint): boolean {
  const acknowledged = getAcknowledgedDocuments();
  const docIdStr = String(documentId);
  return !acknowledged[transactionId]?.documentIds.includes(docIdStr);
}

/**
 * Get count of new (unacknowledged) documents for a transaction
 * @param transactionId - The transaction ID
 * @param allDocumentIds - Array of all document IDs for the transaction
 * @returns Number of documents not yet acknowledged
 */
export function getNewDocumentCount(
  transactionId: string,
  allDocumentIds: (string | number | bigint)[]
): number {
  const acknowledged = getAcknowledgedDocuments();
  const ackedIds = acknowledged[transactionId]?.documentIds || [];
  return allDocumentIds.filter(id => !ackedIds.includes(String(id))).length;
}

/**
 * Get list of new (unacknowledged) document IDs for a transaction
 * @param transactionId - The transaction ID
 * @param allDocumentIds - Array of all document IDs for the transaction
 * @returns Array of document IDs that are new
 */
export function getNewDocumentIds(
  transactionId: string,
  allDocumentIds: (string | number | bigint)[]
): string[] {
  const acknowledged = getAcknowledgedDocuments();
  const ackedIds = acknowledged[transactionId]?.documentIds || [];
  return allDocumentIds
    .filter(id => !ackedIds.includes(String(id)))
    .map(id => String(id));
}

/**
 * Clear acknowledgments for a specific transaction
 * Useful when transaction is deleted or for testing
 * @param transactionId - The transaction ID to clear
 */
export function clearTransactionAcknowledgments(transactionId: string): void {
  const acknowledged = getAcknowledgedDocuments();
  delete acknowledged[transactionId];
  saveAcknowledgedDocuments(acknowledged);
}

/**
 * Clear all acknowledgments (for testing/reset)
 */
export function clearAllAcknowledgments(): void {
  localStorage.removeItem(STORAGE_KEY);
}
