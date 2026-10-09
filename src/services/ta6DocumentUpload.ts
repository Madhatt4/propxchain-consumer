// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Parametrised TA6 document upload — the same off-chain-bytes + on-chain-hash
 * path the TA6 attachment widget uses (ta6Uploader.ts), but with the docType
 * supplied by the caller so the record service can store the generated PDF
 * record ('ta6_pdf_record') and a conveyancer's canonical upload
 * ('ta6_canonical_upload') alongside plain question attachments.
 *
 * File bytes go OFF-CHAIN to the shared Supabase bucket (the buyer's
 * conveyancer must be able to read them); only the SHA-256 hash is anchored
 * ON-CHAIN via the CSRF-gated document_storage.registerDocumentProof, whose
 * ok value is the Nat FK (returned as a string — a Nat can exceed 2^53).
 */

import { supabase } from '../lib/supabase';
import { onChainFileName, storageObjectName } from '../lib/onChainDocument';
import { icpService } from './icp.service';
import { generateFileHash } from '../utils/hashGenerator';

const STORAGE_BUCKET: string = import.meta.env.VITE_HMLR_DOCUMENTS_BUCKET ?? 'propxchain-documents';

/**
 * Upload a TA6-related file and register its on-chain proof under `docType`.
 * Throws with a user-facing message on session, upload, or canister failure.
 */
export async function uploadTA6Document(
  file: File,
  transactionId: string,
  docType: string,
): Promise<string> {
  const contentType = file.type || 'application/octet-stream';
  await requireSession();
  const fileHash = await generateFileHash(file);
  const path = await uploadFormBytes(file, transactionId, 'ta6', fileHash, contentType);
  const storageLocation = `supabase://${STORAGE_BUCKET}/${path}`;
  const documentId = await registerFormProof(file, fileHash, contentType, storageLocation, transactionId, docType);
  icpService.emitDocumentUploadedEvent(transactionId, docType, fileHash);
  return documentId;
}

// Bucket RLS needs a Supabase session — fail with a clear message, not a raw
// RLS error (same guard as ta6Uploader / fundingDocument.service).
export async function requireSession(): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`Could not read your session: ${error.message}`);
  }
  if (!data?.session?.access_token) {
    throw new Error(
      'Please sign in with email to store TA6 documents — secure storage requires an account session.',
    );
  }
}

/**
 * Bytes to the shared bucket under `transactions/<tx>/<folder>/`, returning
 * the bucket-relative path (what doc-classify and the storageLocation use).
 * The whole `transactions/` prefix is one storage fence, so any folder works.
 */
export async function uploadFormBytes(
  file: File,
  transactionId: string,
  folder: string,
  fileHash: string,
  contentType: string,
): Promise<string> {
  // The path becomes the on-chain storageLocation, so no filename in it.
  const path = `transactions/${transactionId}/${folder}/${storageObjectName(fileHash, file.name)}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { contentType, upsert: true });

  if (error) {
    throw new Error(`Secure upload failed: ${error.message}`);
  }
  return path;
}

export async function registerFormProof(
  file: File,
  fileHash: string,
  contentType: string,
  storageLocation: string,
  transactionId: string,
  docType: string,
): Promise<string> {
  await icpService.initialize();
  await icpService.ensureDocumentStorageActor();
  if (!icpService.documentStorageActor) {
    throw new Error('document_storage actor not available');
  }
  const csrfToken = await icpService.getDocumentStorageCsrfToken();
  const result = await icpService.documentStorageActor.registerDocumentProof(
    onChainFileName(docType, file.name),
    fileHash,
    BigInt(file.size),
    contentType,
    storageLocation,
    [transactionId],
    docType,
    csrfToken,
  );
  if ('err' in result) {
    throw new Error(`document_storage rejected proof: ${result.err}`);
  }
  return String(result.ok);
}
