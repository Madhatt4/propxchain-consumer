// TA6 attachment uploader — given a File, return the document_storage
// documentId (stringified Nat) that TA6DocumentValue.documentId stores.
//
// Follows the confirmed funding-document path (fundingDocument.service.ts):
//   1. file bytes go OFF-CHAIN to the shared Supabase bucket (the buyer's
//      conveyancer must be able to read the file, so per-browser IndexedDB
//      is not enough), and
//   2. only the SHA-256 hash is anchored ON-CHAIN via the CSRF-gated
//      document_storage.registerDocumentProof (8-arg shape per
//      document_storage.did.d.ts), whose ok value is the Nat FK.
//
// The id is returned as a STRING because a Nat can exceed 2^53 (see
// ta6.types.ts conversion conventions).

import { supabase } from '../../../../lib/supabase';
import { icpService } from '../../../../services/icp.service';
import { generateFileHash } from '../../../../utils/hashGenerator';

export const TA6_ATTACHMENT_DOC_TYPE = 'ta6_attachment';

const STORAGE_BUCKET: string =
  import.meta.env.VITE_HMLR_DOCUMENTS_BUCKET ?? 'propxchain-documents';

/**
 * Build the DocumentSlot onUpload handler for one transaction. Throws with a
 * user-facing message on session, upload, or canister failure — DocumentSlot
 * surfaces the message inline.
 */
export function makeTa6Uploader(transactionId: string): (file: File) => Promise<string> {
  return async (file: File): Promise<string> => {
    const contentType = file.type || 'application/octet-stream';
    await requireSession();
    const fileHash = await generateFileHash(file);
    const storageLocation = await uploadBytes(file, transactionId, fileHash, contentType);
    const documentId = await registerProof(file, fileHash, contentType, storageLocation, transactionId);
    icpService.emitDocumentUploadedEvent(transactionId, file.name, TA6_ATTACHMENT_DOC_TYPE, fileHash);
    return documentId;
  };
}

// Bucket RLS needs a Supabase session — fail with a clear message, not a raw
// RLS error (same guard as fundingDocument.service.ts).
async function requireSession(): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`Could not read your session: ${error.message}`);
  }
  if (!data?.session?.access_token) {
    throw new Error(
      'Please sign in with email to attach documents — secure storage requires an account session.',
    );
  }
}

async function uploadBytes(
  file: File,
  transactionId: string,
  fileHash: string,
  contentType: string,
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path =
    `transactions/${transactionId}/ta6/` + `${fileHash.substring(0, 12)}-${safeName}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { contentType, upsert: true });

  if (error) {
    throw new Error(`Secure upload failed: ${error.message}`);
  }
  return `supabase://${STORAGE_BUCKET}/${path}`;
}

async function registerProof(
  file: File,
  fileHash: string,
  contentType: string,
  storageLocation: string,
  transactionId: string,
): Promise<string> {
  await icpService.initialize();
  await icpService.ensureDocumentStorageActor();
  if (!icpService.documentStorageActor) {
    throw new Error('document_storage actor not available');
  }
  const csrfToken = await icpService.getDocumentStorageCsrfToken();
  const result = await icpService.documentStorageActor.registerDocumentProof(
    file.name,
    fileHash,
    BigInt(file.size),
    contentType,
    storageLocation,
    [transactionId],
    TA6_ATTACHMENT_DOC_TYPE,
    csrfToken,
  );
  if ('err' in result) {
    throw new Error(`document_storage rejected proof: ${result.err}`);
  }
  return String(result.ok);
}
