// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * jevSpend.service — what the Jev (TypeSafe) calls behind the AI checks are
 * costing, for the admin dashboard. One RPC, `jev_spend_summary`, returns
 * per function and per window the call count, input tokens and the cost the
 * API reported. The function runs as the caller, so a non-admin gets an
 * empty list (jev_decisions admits admins only), never an error to show.
 *
 * Calls logged before cost recording began have no price; they still count
 * as calls and tokens, and the panel says so.
 */
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

export type SpendWindow = 'today' | '7d' | '30d' | 'all';

export const SPEND_WINDOWS: readonly SpendWindow[] = ['today', '7d', '30d', 'all'];

export const SPEND_WINDOW_LABELS: Readonly<Record<SpendWindow, string>> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'All time',
};

/** Plain names for the functions that call Jev, as the panel shows them. */
export const JEV_FUNCTION_LABELS: Readonly<Record<string, string>> = {
  'doc-classify': 'Document checks and consents scan',
  'form-check': 'Check my answers',
  'transaction-monitor': 'Transaction monitor',
  'support-ticket': 'Support triage',
  'support-chat': 'Support chat',
  'enquiry-check': 'Enquiry check',
  'hmlr-scan': 'Title scan judgement',
  'search-scan': 'Searches scan judgement',
  'survey-scan': 'Survey scan judgement',
};

interface SpendRow {
  fn: string;
  spend_window: string;
  calls: number | string;
  input_tokens: number | string;
  cost_usd: number | string | null;
}

export interface FunctionSpend {
  fn: string;
  label: string;
  /** Keyed by window; a window with no calls is absent. */
  windows: Partial<Record<SpendWindow, { calls: number; inputTokens: number; costUsd: number }>>;
}

export interface SpendSummary {
  functions: FunctionSpend[];
  /** Totals across every function, keyed by window. */
  totals: Record<SpendWindow, { calls: number; inputTokens: number; costUsd: number }>;
}

function emptyTotals(): SpendSummary['totals'] {
  return {
    today: { calls: 0, inputTokens: 0, costUsd: 0 },
    '7d': { calls: 0, inputTokens: 0, costUsd: 0 },
    '30d': { calls: 0, inputTokens: 0, costUsd: 0 },
    all: { calls: 0, inputTokens: 0, costUsd: 0 },
  };
}

function isWindow(value: string): value is SpendWindow {
  return (SPEND_WINDOWS as readonly string[]).includes(value);
}

/** Group the flat RPC rows by function and add the totals. Exported for tests. */
export function summariseSpend(rows: readonly SpendRow[]): SpendSummary {
  const byFn = new Map<string, FunctionSpend>();
  const totals = emptyTotals();
  for (const row of rows) {
    if (!isWindow(row.spend_window)) continue;
    const entry = { calls: Number(row.calls), inputTokens: Number(row.input_tokens), costUsd: Number(row.cost_usd ?? 0) };
    const fn = byFn.get(row.fn) ?? { fn: row.fn, label: JEV_FUNCTION_LABELS[row.fn] ?? row.fn, windows: {} };
    fn.windows[row.spend_window] = entry;
    byFn.set(row.fn, fn);
    totals[row.spend_window].calls += entry.calls;
    totals[row.spend_window].inputTokens += entry.inputTokens;
    totals[row.spend_window].costUsd += entry.costUsd;
  }
  const functions = [...byFn.values()].sort((a, b) => (b.windows.all?.calls ?? 0) - (a.windows.all?.calls ?? 0));
  return { functions, totals };
}

/** The summary, or null when it could not be read (not an admin, offline, function missing). */
export async function loadJevSpend(): Promise<SpendSummary | null> {
  try {
    const { data, error } = await supabase.rpc('jev_spend_summary');
    if (error) {
      logger.warn('Jev spend unavailable:', error.message);
      return null;
    }
    return summariseSpend((data ?? []) as SpendRow[]);
  } catch (err) {
    logger.warn('Jev spend request failed:', err);
    return null;
  }
}

/** "$0.0412" for small sums, "$12.34" once they grow; the admin reads a provider bill, so dollars. */
export function formatUsd(value: number): string {
  return value < 1 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
}
