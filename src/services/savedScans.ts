// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Reads the caller's own saved survey and private search scans for a
 * transaction, so the AI Scans tab can show them after a reload. The scan edge
 * functions already store every terminal result; without this the tab only
 * knew about a scan run in the current session.
 *
 * Access is the tables' existing own-row RLS policy (`user_id = auth.uid()`),
 * so a party only ever reads scans they ran. Search reads are pinned to
 * `scope = 'private'`: shared scans have their own panel and their own policy.
 *
 * Never throws: a failed read leaves the panel at "Nothing scanned yet", which
 * is what it showed before. The log carries the error code alone, because these
 * rows can hold personal data.
 */

import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import type { Confidence, ScanFinding, ScanRunResult, ScanStatus } from '../types/scan.types';

export type SavedScanKind = 'survey' | 'search';

const COLUMNS = 'source_ref, status, findings, explainer, flags_for_conveyancer';

// pending and error rows are not results: the edge functions re-run them.
const TERMINAL: readonly ScanStatus[] = ['complete', 'unsupported'];

const CONFIDENCES: readonly Confidence[] = ['high', 'medium', 'low'];

export interface SavedScanRow {
  source_ref: string;
  status: string;
  findings: unknown;
  explainer: string | null;
  flags_for_conveyancer: unknown;
}

function toFinding(raw: unknown): ScanFinding[] {
  const item = (raw ?? {}) as Record<string, unknown>;
  const { key, label, value, provenance, confidence } = item;
  if (typeof key !== 'string' || typeof label !== 'string' || typeof value !== 'string') return [];
  return [{
    key,
    label,
    value,
    // Anything not explicitly marked non-personal is treated as personal, so a
    // malformed row is masked rather than shown in plain view.
    personal_data: item.personal_data !== false,
    confidence: CONFIDENCES.find((c) => c === confidence) ?? 'low',
    provenance: typeof provenance === 'string' ? provenance : '',
  }];
}

function toStrings(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === 'string' && s.length > 0) : [];
}

/** Pure + exported for unit testing. */
export function savedRowToRun(kind: SavedScanKind, row: SavedScanRow): ScanRunResult | null {
  const status = TERMINAL.find((s) => s === row.status);
  if (!status) return null;
  return {
    status,
    result: {
      scan_type: kind,
      source_ref: row.source_ref,
      findings: Array.isArray(row.findings) ? row.findings.flatMap(toFinding) : [],
      explainer: (row.explainer ?? '').trim(),
      flags_for_conveyancer: toStrings(row.flags_for_conveyancer),
    },
  };
}

/** The caller's saved scans of one kind on a transaction, newest first. */
export async function fetchSavedScans(
  kind: SavedScanKind,
  transactionId: string,
): Promise<ScanRunResult[]> {
  try {
    let query = supabase
      .from(kind === 'survey' ? 'survey_scans' : 'search_scans')
      .select(COLUMNS)
      .eq('transaction_id', transactionId)
      .in('status', [...TERMINAL]);
    if (kind === 'search') query = query.eq('scope', 'private');
    const { data, error } = await query.order('updated_at', { ascending: false }).limit(1);
    if (error) {
      logger.error(`Failed to read saved ${kind} scans:`, error.code);
      return [];
    }
    return ((data ?? []) as SavedScanRow[])
      .map((row) => savedRowToRun(kind, row))
      .filter((run): run is ScanRunResult => run !== null);
  } catch {
    return [];
  }
}

/**
 * The filename an upload put in its source_ref (`<kind>:<tx>:<filename>`).
 * A returned OneSearch scan is keyed `search:onesearch:<ref>`, whose last part
 * is an order reference, not a file, so anything not keyed on this transaction
 * gets null.
 */
export function savedScanFilename(sourceRef: string, transactionId: string): string | null {
  const prefix = sourceRef.split(':', 2).join(':') + ':';
  if (prefix.split(':')[1] !== transactionId) return null;
  const name = sourceRef.slice(prefix.length);
  return name || null;
}
