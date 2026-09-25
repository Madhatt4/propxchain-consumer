// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * TA6 record service — persists TA6 6th-edition PDFs to document_storage.
 *
 * Two surfaces:
 *  - storeTA6PdfRecord: renders the structured on-chain answers to a PDF and
 *    stores it as the human-readable record of what the seller submitted.
 *  - uploadCanonicalTA6: lets a conveyancer attach their own canonical-format
 *    TA6 (e.g. the official Law Society PDF). This is a convenience copy only —
 *    the structured on-chain answers remain the authoritative record.
 *
 * Both go through the same off-chain-bytes + on-chain-hash path as the TA6
 * attachment widget (ta6DocumentUpload.uploadTA6Document), differing only in
 * docType so the two artefacts are distinguishable in document_storage.
 */

import { exportTA6ToPDF } from './formExportService';
import { uploadTA6Document } from './ta6DocumentUpload';

import type { ExportContext } from './formExportService';
import type { TA6PropertyInformation } from '../types/ta6.types';

/** document_storage docType for the PropXchain-generated PDF record. */
export const TA6_PDF_RECORD_DOC_TYPE = 'ta6_pdf_record';

/** document_storage docType for a conveyancer's own canonical-format TA6. */
export const TA6_CANONICAL_UPLOAD_DOC_TYPE = 'ta6_canonical_upload';

/**
 * Render the current TA6 answers to a PDF and store it against the
 * transaction. Returns the document_storage documentId (stringified Nat).
 */
export async function storeTA6PdfRecord(
  txId: string,
  form: TA6PropertyInformation,
  context: ExportContext,
): Promise<string> {
  const blob = await exportTA6ToPDF(form, context);
  const file = new File([blob], `TA6-${txId}-record.pdf`, { type: 'application/pdf' });
  return uploadTA6Document(file, txId, TA6_PDF_RECORD_DOC_TYPE);
}

/**
 * Store a conveyancer-supplied canonical-format TA6 file against the
 * transaction. The structured on-chain answers remain authoritative; this is
 * an attached copy. Returns the document_storage documentId (stringified Nat).
 */
export async function uploadCanonicalTA6(txId: string, file: File): Promise<string> {
  return uploadTA6Document(file, txId, TA6_CANONICAL_UPLOAD_DOC_TYPE);
}
