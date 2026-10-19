// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * What each attached document on a transaction was read as, so a TA6 slot can
 * say "Electrical installation condition report (#48)" on every load rather
 * than only right after the upload (Marc, 18 Oct). The canister knows a
 * document's storage path; doc-classify stored its type against that path.
 */
import { supabase } from '../lib/supabase';
import { icpService } from './icp.service';
import { confidentTypeName } from './docClassify.service';
import { logger } from '@/utils/logger';

/** The fields of a getDocumentsByTransaction row this needs. */
interface StoredDocumentRow {
  id: string;
  storageLocation: string;
}

interface ClassificationRow {
  storage_path: string;
  doc_type: string;
  confidence: number | string;
  unreadable: boolean;
}

const SUPABASE_LOCATION = /^supabase:\/\/[^/]+\/(.+)$/;

/**
 * documentId (the stringified document_storage Nat a TA6 slot stores) to the
 * document's type name. Documents never classified, or not confidently, are
 * absent. Resolves to an empty map on any failure: the label is a nicety.
 */
export async function loadAttachmentTypes(transactionId: string): Promise<ReadonlyMap<string, string>> {
  try {
    const [documents, classified] = await Promise.all([
      icpService.getDocumentsByTransaction(transactionId) as Promise<StoredDocumentRow[]>,
      supabase
        .from('document_classifications')
        .select('storage_path, doc_type, confidence, unreadable')
        .eq('transaction_id', transactionId)
        .order('created_at', { ascending: true }),
    ]);
    if (classified.error) {
      logger.warn('Attachment types unavailable:', classified.error.message);
      return new Map();
    }
    // Ascending order, so the newest classification of a path wins.
    const typeByPath = new Map<string, string>();
    for (const row of (classified.data ?? []) as ClassificationRow[]) {
      const name = confidentTypeName({ docType: row.doc_type, confidence: Number(row.confidence), unreadable: row.unreadable });
      if (name) typeByPath.set(row.storage_path, name);
      else typeByPath.delete(row.storage_path);
    }
    const types = new Map<string, string>();
    for (const doc of documents) {
      const path = SUPABASE_LOCATION.exec(doc.storageLocation ?? '')?.[1];
      const name = path ? typeByPath.get(path) : undefined;
      if (name) types.set(String(doc.id).replace(/^doc_/, ''), name);
    }
    return types;
  } catch (err) {
    logger.warn('Attachment types request failed:', err);
    return new Map();
  }
}
