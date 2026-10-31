// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Reads shared search scans: built on the server from the provider's delivery,
 * one per order, read by every party on the transaction.
 *
 * Columns are listed by hand and must stay that way. Every party can read the
 * whole row, including `user_id`, so a wildcard would hand the orderer's id to
 * the other side of the deal.
 */

import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import type {
  ScanFinding,
  SharedScanFlag,
  SharedScanStatus,
  SharedSearchScan,
} from '../types/scan.types';

export const SHARED_SCAN_COLUMNS =
  'id, provider, provider_order_id, status, explainer, flags, warnings, personal_findings_count';

// Postgres and PostgREST codes for a column or table that does not exist yet.
// The site can deploy before the migration, and then there are simply no shared
// scans to show.
const SCHEMA_NOT_READY = new Set(['42703', '42P01', 'PGRST204', 'PGRST205']);

const STATUSES: readonly SharedScanStatus[] = ['pending', 'complete', 'unsupported', 'error'];

interface SharedScanRow {
  id: string;
  provider: string;
  provider_order_id: string | null;
  status: string;
  explainer: string | null;
  flags: unknown;
  warnings: unknown;
  personal_findings_count: number | null;
}

interface PersonalFindingsRow {
  scan_id: string;
  findings: unknown;
}

function toStatus(raw: string): SharedScanStatus {
  return STATUSES.find((s) => s === raw) ?? 'error';
}

function toFlags(raw: unknown): SharedScanFlag[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): SharedScanFlag[] => {
    const { statement, search_name: searchName, location } = (item ?? {}) as Record<string, unknown>;
    if (typeof statement !== 'string' || !statement.trim()) return [];
    if (typeof searchName !== 'string') return [];
    return [{ statement, searchName, ...(typeof location === 'string' && location ? { location } : {}) }];
  });
}

function toWarnings(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((w): w is string => typeof w === 'string' && w.length > 0) : [];
}

/**
 * The orderer's personal findings, by scan id. RLS returns only the caller's
 * own, so anyone else gets an empty map and sees the count. A failure here falls
 * back to the same view: nothing on the shared row depends on it.
 */
async function fetchPersonalFindings(scanIds: string[]): Promise<Map<string, ScanFinding[]>> {
  if (scanIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('search_scan_personal_findings')
    .select('scan_id, findings')
    .in('scan_id', scanIds);
  if (error || !data) return new Map();
  return new Map(
    (data as PersonalFindingsRow[])
      .filter((row) => Array.isArray(row.findings))
      .map((row) => [row.scan_id, row.findings as ScanFinding[]]),
  );
}

/** Throws on a real failure, so the tab can say so instead of showing nothing. */
export async function fetchSharedSearchScans(transactionId: string): Promise<SharedSearchScan[]> {
  const { data, error } = await supabase
    .from('search_scans')
    .select(SHARED_SCAN_COLUMNS)
    .eq('transaction_id', transactionId)
    .eq('scope', 'shared')
    .order('created_at', { ascending: false });

  if (error) {
    if (SCHEMA_NOT_READY.has(error.code)) return [];
    logger.error('Failed to read shared search scans:', error.message);
    throw new Error('shared search scans could not be read');
  }

  const rows = (data ?? []) as SharedScanRow[];
  const personal = await fetchPersonalFindings(
    rows.filter((r) => (r.personal_findings_count ?? 0) > 0).map((r) => r.id),
  );

  return rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    providerOrderId: row.provider_order_id,
    status: toStatus(row.status),
    explainer: (row.explainer ?? '').trim(),
    flags: toFlags(row.flags),
    warnings: toWarnings(row.warnings),
    personalFindingsCount: row.personal_findings_count ?? 0,
    personalFindings: personal.get(row.id) ?? null,
  }));
}
