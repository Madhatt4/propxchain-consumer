// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The stage card's "Upload completed form" path for a TA6, TA10 or TA7 PDF.
 *
 * Until 2026-10-09 this accepted any PDF as the seller's finished form and
 * ticked the stage: a sign-in guide went through as the TA6. Now the bytes go
 * to the shared bucket first, doc-classify is asked what arrived, and a file
 * that confidently reads as something else is removed again and refused with
 * the reason. Only then is the on-chain proof registered.
 *
 * The gate is one-sided on purpose. A file the classifier cannot read (a
 * scan), is unsure about, or cannot be reached for at all goes through as
 * `unverified` with the reason carried back for the caller to show; refusing
 * those would block a real form a seller scanned on their phone. Only a
 * confident "this is an EPC" or "this is a TA10" is a refusal.
 */
import { requireSession, registerFormProof, uploadFormBytes } from './ta6DocumentUpload';
import { classifyDocument, DOC_TYPE_CONFIDENCE_AT, docTypeLabel } from './docClassify.service';
import { icpService } from './icp.service';
import { generateFileHash } from '../utils/hashGenerator';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import type { DocClassification } from './docClassify.service';

export type CompletedFormId = 'ta6' | 'ta10' | 'ta7';

export type CompletedFormVerdict = 'accepted' | 'unverified' | 'rejected';

export interface CompletedFormJudgement {
  verdict: CompletedFormVerdict;
  /** Why, for the seller: null only when accepted. */
  reason: string | null;
}

export interface CompletedFormUpload extends CompletedFormJudgement {
  /** The document_storage documentId (stringified Nat). */
  documentId: string;
}

/** Thrown when the file was confidently not the form; nothing was kept. */
export class CompletedFormRejectedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'CompletedFormRejectedError';
  }
}

/** doc-classify's answer key for each form, and the proof's docType. */
const FORM_DOC_TYPE: Record<CompletedFormId, string> = {
  ta6: 'ta6_form',
  ta10: 'ta10_form',
  ta7: 'ta7_form',
};

const STORAGE_BUCKET: string = import.meta.env.VITE_HMLR_DOCUMENTS_BUCKET ?? 'propxchain-documents';

/** Pure: what the classification says about a file handed in as `formId`. */
export function judgeCompletedForm(
  formId: CompletedFormId,
  classification: DocClassification | null,
): CompletedFormJudgement {
  if (classification === null) return { verdict: 'unverified', reason: "We couldn't check this file right now." };
  if (classification.unreadable) return { verdict: 'unverified', reason: "We couldn't read the text in this file." };
  if (classification.confidence < DOC_TYPE_CONFIDENCE_AT) {
    return { verdict: 'unverified', reason: "We couldn't confirm what this document is." };
  }
  if (classification.docType === FORM_DOC_TYPE[formId]) return { verdict: 'accepted', reason: null };
  const expected = docTypeLabel(FORM_DOC_TYPE[formId]);
  const actual =
    classification.docType === 'other' ? 'none of the documents we recognise' : docTypeLabel(classification.docType);
  return { verdict: 'rejected', reason: `This reads as ${actual}, not ${expected}.` };
}

/**
 * Upload, classify, then either register the proof or remove the object and
 * throw `CompletedFormRejectedError`. Other failures (session, storage,
 * canister) throw with their own user-facing message as before.
 */
export async function uploadCompletedForm(
  file: File,
  transactionId: string,
  formId: CompletedFormId,
): Promise<CompletedFormUpload> {
  const contentType = file.type || 'application/octet-stream';
  await requireSession();
  const fileHash = await generateFileHash(file);
  const path = await uploadFormBytes(file, transactionId, formId, fileHash, contentType);

  const judgement = judgeCompletedForm(formId, await classifyDocument(transactionId, path));
  if (judgement.verdict === 'rejected') {
    // Best effort: a refused file must not sit in the bucket, but a failed
    // clean-up is not the seller's problem and must not hide the real reason.
    await supabase.storage.from(STORAGE_BUCKET).remove([path]);
    throw new CompletedFormRejectedError(judgement.reason ?? 'This does not look like the right form.');
  }

  const docType = canonicalUploadDocType(formId);
  const storageLocation = `supabase://${STORAGE_BUCKET}/${path}`;
  const documentId = await registerFormProof(file, fileHash, contentType, storageLocation, transactionId, docType);
  icpService.emitDocumentUploadedEvent(transactionId, docType, fileHash);
  return { documentId, ...judgement };
}

/** document_storage docType under which the stage card registers a completed form PDF. */
export function canonicalUploadDocType(formId: CompletedFormId): string {
  return `${formId}_canonical_upload`;
}

/** The fields of an icpService.getDocumentsByTransaction row this needs. */
interface StoredDocumentRow {
  id: string;
  type: string;
  storageLocation: string;
}

const SUPABASE_LOCATION = /^supabase:\/\/([^/]+)\/(.+)$/;

/** `doc_<nat>` is how getDocumentsByTransaction names a document_storage row. */
function storageIdOf(row: StoredDocumentRow): number | null {
  const n = Number(String(row.id).replace(/^doc_/, ''));
  return Number.isFinite(n) ? n : null;
}

/** Best effort: the proof is already gone, so a bucket object left behind is clutter, not a record. */
async function removeBytes(storageLocation: string): Promise<void> {
  const match = SUPABASE_LOCATION.exec(storageLocation);
  if (!match) return;
  const { error } = await supabase.storage.from(match[1]).remove([match[2]]);
  if (error) logger.warn('Completed form bytes not removed:', error.message);
}

export interface WithdrawnCompletedForm {
  /** How many stored PDFs were removed before the flag was cleared. */
  removed: number;
}

/**
 * Take back a completed-form PDF uploaded by mistake. In order: every
 * document_storage proof registered for this form on the transaction is
 * deleted (the canister refuses anyone but the uploader or an admin), its
 * bytes are removed from the bucket, and only then is the transaction told
 * the upload no longer stands. A proof that will not delete stops the
 * withdrawal before the flag changes, so the form never reads as removed
 * while its PDF is still on record. A form filled in online is untouched.
 */
export async function withdrawCompletedForm(
  transactionId: string,
  formId: CompletedFormId,
): Promise<WithdrawnCompletedForm> {
  const wanted = canonicalUploadDocType(formId);
  const rows = ((await icpService.getDocumentsByTransaction(transactionId)) as StoredDocumentRow[]).filter(
    (row) => row.type === wanted,
  );

  let removed = 0;
  for (const row of rows) {
    const storageId = storageIdOf(row);
    if (storageId === null) throw new Error('Could not identify the stored PDF to remove.');
    const deleted = await icpService.deleteStorageDocument(storageId);
    if (!deleted) throw new Error('The stored PDF could not be removed. Please try again.');
    await removeBytes(row.storageLocation);
    removed += 1;
  }

  await icpService.unrecordFormUpload(transactionId, formId);
  return { removed };
}
