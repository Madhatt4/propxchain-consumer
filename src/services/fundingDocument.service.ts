// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Funding Document Service
 *
 * Persists a buyer's funding-stage PII document (mortgage offer / AIP, or
 * proof-of-funds bank statement) per the document access & storage matrix
 * (docs/document-access-matrix.md, row "Proof of Funds" / "Mortgage Offer").
 *
 * GDPR routing — these documents are PII, so they follow `Off+hash`:
 *   1. the file bytes live OFF-CHAIN in Supabase storage (the same
 *      `propxchain-documents` bucket the HMLR extract already uses), and
 *   2. only the SHA-256 hash is anchored ON-CHAIN (document_storage proof +
 *      document_verification record) as an integrity/audit stub.
 * Erasing the off-chain file then satisfies the right to erasure while the
 * on-chain hash remains a meaningless anchor.
 *
 * The off-chain store is deliberately Supabase, not the per-browser IndexedDB
 * other flows use: the matrix grants the conveyancer Full access to the file,
 * which is only possible from a shared server store the conveyancer's own
 * device can read.
 *
 * Reuses the existing `registerDocumentProof` + `registerDocument` path — it
 * does not introduce a new storage contract.
 */

import { supabase } from '../lib/supabase';
import { icpService } from './icp.service';
import { generateFileHash } from '../utils/hashGenerator';
import { getBackendDocumentName } from '../constants/documentTypes';
import { logger } from '@/utils/logger';

const STORAGE_BUCKET =
  import.meta.env.VITE_HMLR_DOCUMENTS_BUCKET ?? 'propxchain-documents';

export interface FundingDocumentRecord {
  storageDocId: number;
  verificationDocId: number;
  fileHash: string;
  storageLocation: string;
  fileName: string;
  fileSize: number;
  contentType: string;
}

export interface UploadFundingDocumentOptions {
  /** Canonical transaction key in "tx_<n>" form. */
  transactionId: string;
  /** A `documentTypes.ts` storageKey, e.g. 'mortgageAgreement' | 'proofOfFunds'. */
  documentType: string;
  /** Property id if known; 0 is tolerated — access falls back to tx membership. */
  propertyId?: number;
  /**
   * Storage sub-folder under `transactions/<id>/`. Defaults to `funding`.
   * Other `Off+hash` PII documents reuse this path with their own folder
   * (see `surveyDocument.service.ts`) rather than duplicating the contract.
   */
  folder?: string;
}

class FundingDocumentService {
  /**
   * Off-chain (Supabase) store + on-chain hash anchor for a funding PII doc.
   * Throws with a user-facing message on auth, upload, or access-denial failure.
   */
  async uploadFundingDocument(
    file: File,
    opts: UploadFundingDocumentOptions,
  ): Promise<FundingDocumentRecord> {
    const { transactionId, documentType, propertyId = 0, folder = 'funding' } = opts;
    const contentType = file.type || 'application/octet-stream';

    // PII off-chain storage is gated by the bucket's RLS, which needs a
    // Supabase session. Fail with a clear message rather than a raw RLS error.
    await this.requireSession();

    const fileHash = await generateFileHash(file);
    const storageLocation = await this.uploadToSupabase(
      file,
      transactionId,
      documentType,
      fileHash,
      contentType,
      folder,
    );

    await icpService.initialize();
    const storageDocId = await this.registerProof(
      file,
      fileHash,
      contentType,
      storageLocation,
      transactionId,
      documentType,
    );
    const verificationDocId = await this.registerVerification(
      file,
      fileHash,
      contentType,
      storageDocId,
      transactionId,
      documentType,
      propertyId,
    );

    // Audit anchor: the seller's "Tick" milestone notice and the conveyancer's
    // access both derive from this event + transaction membership.
    icpService.emitDocumentUploadedEvent(transactionId, file.name, documentType, fileHash);
    await this.updateProgress(transactionId, documentType);

    return {
      storageDocId,
      verificationDocId,
      fileHash,
      storageLocation,
      fileName: file.name,
      fileSize: file.size,
      contentType,
    };
  }

  private async requireSession(): Promise<void> {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw new Error(`Could not read your session: ${error.message}`);
    }
    if (!data?.session?.access_token) {
      throw new Error(
        'Please sign in with email to upload documents — secure off-chain storage requires an account session.',
      );
    }
  }

  private async uploadToSupabase(
    file: File,
    transactionId: string,
    documentType: string,
    fileHash: string,
    contentType: string,
    folder: string,
  ): Promise<string> {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path =
      `transactions/${transactionId}/${folder}/` +
      `${documentType}-${fileHash.substring(0, 12)}-${safeName}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { contentType, upsert: true });

    if (error) {
      throw new Error(`Secure upload failed: ${error.message}`);
    }
    return `supabase://${STORAGE_BUCKET}/${path}`;
  }

  private async registerProof(
    file: File,
    fileHash: string,
    contentType: string,
    storageLocation: string,
    transactionId: string,
    documentType: string,
  ): Promise<number> {
    await icpService.ensureDocumentStorageActor();
    if (!icpService.documentStorageActor) {
      throw new Error('document_storage actor not available');
    }
    const csrfToken = await icpService.getDocumentStorageCsrfToken();
    const result = await (await icpService.requireDocumentStorage()).registerDocumentProof(
      file.name,
      fileHash,
      BigInt(file.size),
      contentType,
      storageLocation,
      [transactionId],
      documentType,
      csrfToken,
    );
    if ('err' in result) {
      throw new Error(`document_storage rejected proof: ${result.err}`);
    }
    return Number(result.ok);
  }

  private async registerVerification(
    file: File,
    fileHash: string,
    contentType: string,
    storageDocId: number,
    transactionId: string,
    documentType: string,
    propertyId: number,
  ): Promise<number> {
    const numericTransactionId = transactionId.replace(/^tx_/, '');
    const docId = await (await icpService.requireDocumentVerification()).registerDocument(
      BigInt(propertyId),
      numericTransactionId ? [BigInt(numericTransactionId)] : [],
      documentType,
      fileHash,
      [BigInt(storageDocId)],
      [file.name],
      [BigInt(file.size)],
      [contentType],
    );
    // The canister returns 0 on access denial (#75): anonymous caller, or no
    // owner/transaction-member/solicitor relationship. Surface it, don't swallow.
    if (Number(docId) === 0) {
      throw new Error(
        'Access denied: you are not permitted to register this document against this transaction.',
      );
    }
    return Number(docId);
  }

  private async updateProgress(transactionId: string, documentType: string): Promise<void> {
    const numericTransactionId = transactionId.replace(/^tx_/, '');
    if (!numericTransactionId) return;
    try {
      const backendDocName = getBackendDocumentName(documentType);
      if (!backendDocName) return;
      // Via the service wrapper: it stringifies the id and attaches the CSRF
      // token, both of which this raw actor call was missing.
      await icpService.updateMemberDocuments(numericTransactionId, backendDocName);
    } catch (err) {
      // Best-effort: the document is already recorded; progress is cosmetic.
      logger.warn('[funding] progress update failed', err);
    }
  }
}

export const fundingDocumentService = new FundingDocumentService();
export default fundingDocumentService;
