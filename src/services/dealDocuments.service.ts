// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Deal documents service — the property documents on a deal, for every party
 * on it (Marc, 2026-11-09: "anyone in a transaction should be able to see
 * searches, surveys … for transparency").
 *
 * - The list comes from document_storage (icpService.getDocumentsByTransaction),
 *   which since monorepo #419 returns property docTypes to every party. Rows
 *   are filtered again here with dealDocGroup, so a personal document is never
 *   listed even if a server list returns it.
 * - The uploader is shown as a role ("Seller's conveyancer"), never a name:
 *   the transaction record gives the buyer and seller, get_share_party_sides
 *   gives everyone else's role and side.
 * - Bytes come from Supabase storage, where RLS decides who may read
 *   (monorepo #418). Until that is applied another party's file is refused,
 *   which the caller shows as "can't be opened yet".
 * - Survey scans come from the deal_survey_scans RPC (#418), personal findings
 *   already removed. Before #418 the RPC is missing and this returns null.
 */
import { supabase } from '../lib/supabase';
import { icpService } from './icp.service';
import { getStorePrincipalId } from '../stores/authStore';
import { savedRowToRun } from './savedScans';
import { dealDocGroup, dealDocTypeLabel, type DealDocGroup } from '../lib/dealDocumentKinds';
import { fileExtension } from '../lib/onChainDocument';
import { EXT_BY_MIME } from '../types/vault.types';
import { logger } from '../utils/logger';
import type { ScanRunResult } from '../types/scan.types';

const SUPABASE_LOCATION = /^supabase:\/\/([^/]+)\/(.+)$/;

/** Shown when storage refuses the read: before #418, or a file not yet shared. */
export const CANNOT_OPEN_YET = "This file can't be opened from your account yet.";

export interface DealDocument {
  id: string;
  group: DealDocGroup;
  docType: string;
  typeLabel: string;
  fileName: string;
  /** Role label of whoever uploaded it, e.g. "Seller" or "Buyer's conveyancer". */
  uploadedByLabel: string;
  uploadedAt: string | null;
  storageLocation: string;
  /** True when the bytes are held in Supabase, so Open can fetch them. */
  canOpen: boolean;
  fileHash: string;
  contentType: string;
}

/** The fields of an icpService.getDocumentsByTransaction row this needs. */
interface StoredDocumentRow {
  id: string;
  type?: string;
  fileName?: string;
  uploadedBy?: string;
  uploadedAt?: string;
  storageLocation?: string;
  hash?: string;
  contentType?: string;
}

interface PartySideRow {
  icp_principal: string;
  party_role: string;
  side: string | null;
}

interface PrincipalLike {
  toString(): string;
}

interface TransactionParties {
  buyer?: PrincipalLike | null;
  seller?: PrincipalLike | null;
  solicitor?: readonly PrincipalLike[];
  accessList?: readonly PrincipalLike[];
}

const PARTY_FALLBACK = 'Party on the deal';

/** A role and side from get_share_party_sides as a label. Pure, exported for tests. */
export function roleLabel(role: string, side: string | null): string {
  const sideWord = side === 'buyer' ? "Buyer's" : side === 'seller' ? "Seller's" : null;
  switch (role) {
    case 'buyer': return 'Buyer';
    case 'seller': return 'Seller';
    case 'conveyancer': return sideWord ? `${sideWord} conveyancer` : 'Conveyancer';
    case 'estate_agent': return 'Estate agent';
    default: return PARTY_FALLBACK;
  }
}

async function offChainRoles(transactionId: string, principals: string[]): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  if (principals.length === 0) return labels;
  const { data, error } = await supabase.rpc('get_share_party_sides', {
    p_transaction_id: transactionId,
    p_principals: principals,
  });
  if (error) {
    logger.warn('[dealDocuments] party side lookup failed', error.code);
    return labels;
  }
  for (const row of (data ?? []) as PartySideRow[]) {
    labels.set(row.icp_principal, roleLabel(row.party_role, row.side));
  }
  return labels;
}

/**
 * Principal -> role label for the deal. Never throws: an unknown uploader is
 * shown as "Party on the deal" rather than failing the whole list.
 */
export async function loadUploaderLabels(transactionId: string, uploaders: string[]): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  try {
    const tx = (await icpService.getTransaction(transactionId)) as TransactionParties | null;
    const seller = tx?.seller?.toString();
    const buyer = tx?.buyer?.toString();
    if (seller) labels.set(seller, 'Seller');
    // Until a buyer joins the canister stores the seller in the buyer slot.
    if (buyer && buyer !== seller) labels.set(buyer, 'Buyer');
    const rest = uploaders.filter((p) => p && !labels.has(p));
    for (const [p, label] of await offChainRoles(transactionId, [...new Set(rest)])) labels.set(p, label);
    for (const s of tx?.solicitor ?? []) if (!labels.has(s.toString())) labels.set(s.toString(), 'Conveyancer');
  } catch (err) {
    logger.warn('[dealDocuments] uploader roles unavailable', err instanceof Error ? err.message : '');
  }
  return labels;
}

function toDealDocument(row: StoredDocumentRow, group: DealDocGroup, labels: Map<string, string>): DealDocument {
  const docType = row.type ?? '';
  const by = row.uploadedBy ?? '';
  const base = labels.get(by) ?? PARTY_FALLBACK;
  return {
    id: String(row.id),
    group,
    docType,
    typeLabel: dealDocTypeLabel(docType),
    fileName: row.fileName ?? docType,
    uploadedByLabel: by && by === getStorePrincipalId() ? `${base} (you)` : base,
    uploadedAt: row.uploadedAt ?? null,
    storageLocation: row.storageLocation ?? '',
    canOpen: SUPABASE_LOCATION.test(row.storageLocation ?? ''),
    fileHash: row.hash ?? '',
    contentType: row.contentType ?? '',
  };
}

/**
 * The property documents on the deal, newest first. Throws when the list
 * itself fails, so the view can say "could not load" rather than "none".
 */
export async function listDealDocuments(transactionId: string): Promise<DealDocument[]> {
  const rows = (await icpService.getDocumentsByTransaction(transactionId)) as StoredDocumentRow[];
  const property = rows.flatMap((row) => {
    const group = dealDocGroup(row.type ?? '');
    return group ? [{ row, group }] : [];
  });
  if (property.length === 0) return [];
  const labels = await loadUploaderLabels(transactionId, property.map((p) => p.row.uploadedBy ?? ''));
  return property
    .map(({ row, group }) => toDealDocument(row, group, labels))
    .sort((a, b) => (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? ''));
}

/**
 * The stored bytes of one deal document. Storage RLS decides who may read.
 *
 * @throws Error with a user-facing message when the file cannot be read.
 */
export async function fetchDealDocumentFile(doc: DealDocument): Promise<Blob> {
  const match = SUPABASE_LOCATION.exec(doc.storageLocation);
  if (!match) throw new Error('This document has no stored copy to open.');
  const { data, error } = await supabase.storage.from(match[1]).download(match[2]);
  if (error || !data) throw new Error(CANNOT_OPEN_YET);
  return data;
}

/** Saved under the type label plus a short hash, never the uploader's own filename. */
export function dealDocDownloadName(doc: DealDocument, blobType = ''): string {
  const ext = fileExtension(doc.fileName) || EXT_BY_MIME[doc.contentType] || EXT_BY_MIME[blobType] || '';
  const hash = doc.fileHash.slice(0, 8);
  return `${doc.typeLabel.replace(/[^a-z0-9]+/gi, '-')}${hash ? `-${hash}` : ''}${ext}`;
}

interface DealSurveyScanRow {
  status: string;
  findings: unknown;
  explainer: string | null;
  flags_for_conveyancer: unknown;
  personal_findings_count: number | null;
}

export interface DealSurveyScan {
  run: ScanRunResult;
  /** Findings held back because they are personal; shown as a count only. */
  personalFindingsCount: number;
}

/**
 * Survey scans shared on the deal, with personal findings removed by the
 * server. Null when the RPC is unavailable (before #418) or fails, so the
 * view can hide the section. Never throws.
 */
export async function fetchDealSurveyScans(transactionId: string): Promise<DealSurveyScan[] | null> {
  try {
    const { data, error } = await supabase.rpc('deal_survey_scans', { p_transaction_id: transactionId });
    if (error) {
      logger.warn('[dealDocuments] deal_survey_scans unavailable', error.code);
      return null;
    }
    return ((data ?? []) as DealSurveyScanRow[]).flatMap((row) => {
      const run = savedRowToRun('survey', { ...row, source_ref: `survey:${transactionId}:` });
      return run ? [{ run, personalFindingsCount: row.personal_findings_count ?? 0 }] : [];
    });
  } catch (err: unknown) {
    // A shape change in the RPC must not break the page, but it must be visible.
    logger.warn('[dealDocuments] deal_survey_scans could not be read', err instanceof Error ? err.message : 'unknown');
    return null;
  }
}

export const dealDocumentsService = {
  listDealDocuments,
  fetchDealDocumentFile,
  dealDocDownloadName,
  fetchDealSurveyScans,
  loadUploaderLabels,
};
export default dealDocumentsService;
