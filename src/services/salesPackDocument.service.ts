// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Sales Pack Document Service
 *
 * The seller's "other documents" in the sales pack (EPC, floor plan, FENSA,
 * gas safety, EICR, warranty, lease, title plan, other). These used to live in
 * the seller's browser (IndexedDB) only, so the buyer and both conveyancers
 * never saw them (live test, 2026-11-09).
 *
 * They are property documents, not identity documents, but a certificate or
 * plan can still name the occupier, so they follow `Off+hash` like funding and
 * survey uploads: bytes OFF-CHAIN in Supabase under
 * `transactions/<tx>/sales-pack/`, only the SHA-256 hash ON-CHAIN (a
 * document_storage proof plus a document_verification record), which is what
 * puts each upload on the deal's audit trail.
 *
 * Reuses the contract in `fundingDocument.service.ts` under its own folder,
 * the same way `surveyDocument.service.ts` does. It adds no storage contract.
 */

import { supabase } from '../lib/supabase';
import { icpService } from './icp.service';
import {
  fundingDocumentService,
  type FundingDocumentRecord,
} from './fundingDocument.service';
import { isPackDocument, packDocLabel } from '../lib/packDocKinds';

/** Storage sub-folder under `transactions/<id>/`. */
export const SALES_PACK_FOLDER = 'sales-pack';

/** Same limit the pack's IndexedDB slot always used. */
export const MAX_SALES_PACK_BYTES = 10 * 1024 * 1024;

export const SALES_PACK_ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

// Leading bytes for each accepted type. The browser's MIME type comes from the
// file extension, which the uploader controls, so it proves nothing on its own.
const MAGIC: Record<(typeof SALES_PACK_ACCEPTED_TYPES)[number], readonly number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d],
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
};

const SUPABASE_LOCATION = /^supabase:\/\/([^/]+)\/(.+)$/;

export type SalesPackDocumentRecord = FundingDocumentRecord;

export interface UploadSalesPackDocumentOptions {
  /** Canonical transaction key in "tx_<n>" form. */
  transactionId: string;
  /** A PACK_DOC_KINDS id, stored as the on-chain docType. */
  kind: string;
  /** Property id if known; 0 is tolerated — access falls back to tx membership. */
  propertyId?: number;
}

/** A pack document as any party on the deal sees it in the list. */
export interface SalesPackDocument {
  id: string;
  kind: string;
  label: string;
  /** The on-chain name: the kind plus the extension, never the user's filename. */
  fileName: string;
  uploadedAt: string | null;
  storageLocation: string;
  fileHash: string;
  contentType: string;
}

/** The fields of an icpService.getDocumentsByTransaction row this needs. */
interface StoredDocumentRow {
  id: string;
  type?: string;
  fileName?: string;
  uploadedAt?: string;
  storageLocation?: string;
  hash?: string;
  contentType?: string;
}

function hasMagic(head: Uint8Array, magic: readonly number[]): boolean {
  return head.length >= magic.length && magic.every((b, i) => head[i] === b);
}

async function readHead(file: File, length: number): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, length).arrayBuffer());
}

/**
 * Why a file cannot go in the pack, or null when it can. Checks the claimed
 * type, the size, and that the bytes really are that type. Never throws.
 */
export async function validateSalesPackFile(file: File): Promise<string | null> {
  const type = SALES_PACK_ACCEPTED_TYPES.find((t) => t === file.type);
  if (!type) return 'PDF, JPG or PNG only.';
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > MAX_SALES_PACK_BYTES) return 'Files up to 10MB only.';
  try {
    const head = await readHead(file, 8);
    if (!hasMagic(head, MAGIC[type])) {
      return `${file.name} doesn't look like a real PDF, JPG or PNG.`;
    }
  } catch {
    return `${file.name} could not be read.`;
  }
  return null;
}

/**
 * Validate and store one sales pack document where every party on the deal
 * can reach it, and register it on-chain.
 *
 * @throws Error with a user-facing message on validation, auth, upload, or
 *   access-denial failure.
 */
export async function uploadSalesPackDocument(
  file: File,
  opts: UploadSalesPackDocumentOptions,
): Promise<SalesPackDocumentRecord> {
  // Only pack kinds: identity documents are shared from the wallet, and the
  // kind becomes permanent on-chain docType text.
  if (!isPackDocument(opts.kind)) {
    throw new Error('Choose a document type for the pack.');
  }
  const rejection = await validateSalesPackFile(file);
  if (rejection) throw new Error(rejection);

  return fundingDocumentService.uploadFundingDocument(file, {
    transactionId: opts.transactionId,
    propertyId: opts.propertyId,
    documentType: opts.kind,
    folder: SALES_PACK_FOLDER,
  });
}

function toPackDocument(row: StoredDocumentRow): SalesPackDocument {
  const kind = row.type ?? '';
  return {
    id: String(row.id),
    kind,
    label: packDocLabel(kind),
    fileName: row.fileName ?? kind,
    uploadedAt: row.uploadedAt ?? null,
    storageLocation: row.storageLocation ?? '',
    fileHash: row.hash ?? '',
    contentType: row.contentType ?? '',
  };
}

/**
 * The pack documents this caller may see on the deal, from document_storage,
 * newest first. Only server-held copies: a row whose bytes are not in Supabase
 * could not be opened by anyone else. Throws when the lookup fails, so the
 * caller can say "could not load" rather than "nothing added".
 */
export async function listSalesPackDocuments(transactionId: string): Promise<SalesPackDocument[]> {
  const rows = (await icpService.getDocumentsByTransaction(transactionId)) as StoredDocumentRow[];
  return rows
    .filter((r) => isPackDocument(r.type ?? '') && SUPABASE_LOCATION.test(r.storageLocation ?? ''))
    .map(toPackDocument)
    .sort((a, b) => (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? ''));
}

/**
 * The stored bytes of one pack document. Storage RLS decides who may read it.
 *
 * @throws Error with a user-facing message when the file cannot be read.
 */
export async function fetchSalesPackFile(doc: SalesPackDocument): Promise<Blob> {
  const match = SUPABASE_LOCATION.exec(doc.storageLocation);
  if (!match) throw new Error('This document has no stored copy to open.');
  const { data, error } = await supabase.storage.from(match[1]).download(match[2]);
  if (error || !data) {
    throw new Error("This file can't be opened from your account yet.");
  }
  return data;
}

export const salesPackDocumentService = {
  validateSalesPackFile,
  uploadSalesPackDocument,
  listSalesPackDocuments,
  fetchSalesPackFile,
};
export default salesPackDocumentService;
