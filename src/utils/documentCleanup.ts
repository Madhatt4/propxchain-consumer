import { localDocumentRegistry } from '../services/localDocumentRegistry';
import { logger } from '@/utils/logger';

interface CleanupTarget {
  id: string;
  transactionId: string;
  type: string;
  hash?: string;
  storageDocumentId?: number;
}

/**
 * Removes all frontend state left behind when a document is deleted.
 *
 * Covers:
 *  1. Oscar analysis results (4 key formats)
 *  2. Storage→Verification ID mapping
 *  3. Local document registry (IndexedDB)
 */
export function cleanupDocumentState(doc: CleanupTarget): void {
  const keysToRemove: string[] = [];

  // Oscar primary key
  if (doc.transactionId && doc.type) {
    keysToRemove.push(`oscar_tx_${doc.transactionId}_${doc.type}`);
  }

  // Oscar fallback keys
  keysToRemove.push(`oscar_result_${doc.id}`);
  if (doc.hash) {
    keysToRemove.push(`oscar_result_hash_${doc.hash}`);
  }
  if (doc.storageDocumentId) {
    keysToRemove.push(`oscar_result_doc_${doc.storageDocumentId}`);
    keysToRemove.push(`doc_id_mapping_${doc.storageDocumentId}`);
  }

  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
  logger.info('[Cleanup] Removed localStorage keys:', keysToRemove);

  // Remove from IndexedDB local registry (fire-and-forget)
  localDocumentRegistry.removeDocument(doc.id).catch((err) => {
    logger.warn('[Cleanup] Local registry removal failed:', err);
  });
}
