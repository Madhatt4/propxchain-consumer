// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Next-step service.
 *
 * Bridges the canister rules engine with off-chain enrichment. The canister
 * `getNextStep` composite query is the source of truth for blockers and
 * options; this service layers on a count of the firms on the conveyancer
 * panel when the blocker is `no_solicitor`, so the "Browse the conveyancer
 * panel" option can say how many firms are ready to give an estimate.
 *
 * Failure mode: if Supabase enrichment fails the canister recommendation is
 * returned untouched. Off-chain data is decoration, not gate.
 */

import { icpService } from './icp.service';
import { supabase } from '../lib/supabase';
import { currentUserIsTestAccount, keepFirmsFor } from './testFirm';
import { logger } from '@/utils/logger';

export type NextStepUrgency = 'blocking' | 'soon' | 'later';

export interface NextStepOption {
  action: string;
  displayLabel: string;
  whyThis: string;
  estimatedDelayIfSkipped?: number;
  /** Off-chain enrichment — populated for `browse_conveyancer_panel` only. */
  panelMatchCount?: number;
}

export interface NextStepRecommendation {
  blocker: string;
  blockerLabel: string;
  options: NextStepOption[];
  urgency: NextStepUrgency;
  why: string;
  partial: boolean;
}

export interface NextStepError {
  code: 'not_found' | 'access_denied' | 'anonymous' | 'unknown';
  message: string;
}

/**
 * Read the next-step recommendation for a transaction. The result is the
 * canister output enriched with Supabase data where applicable.
 */
export async function getNextStep(
  transactionId: string,
): Promise<{ ok: NextStepRecommendation } | { err: NextStepError }> {
  try {
    const result = await icpService.getNextStep(transactionId);

    // Canister returns a Result variant — Candid encodes as { ok } | { err }.
    if ('err' in result) {
      return { err: classifyError(result.err as string) };
    }

    const raw = result.ok as RawCanisterRecommendation;
    const base: NextStepRecommendation = {
      blocker: raw.blocker,
      blockerLabel: raw.blockerLabel,
      urgency: extractVariant(raw.urgency),
      why: raw.why,
      partial: raw.partial,
      options: raw.options.map((o) => ({
        action: o.action,
        displayLabel: o.displayLabel,
        whyThis: o.whyThis,
        estimatedDelayIfSkipped:
          o.estimatedDelayIfSkipped.length > 0
            ? Number(o.estimatedDelayIfSkipped[0])
            : undefined,
      })),
    };

    if (base.blocker === 'no_solicitor') {
      const enriched = await enrichWithConveyancerPanel(base);
      return { ok: enriched };
    }

    return { ok: base };
  } catch (err) {
    logger.warn('[next-step] canister call failed', err);
    return {
      err: {
        code: 'unknown',
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

// ============================================================
// Helpers
// ============================================================

interface RawCanisterRecommendation {
  blocker: string;
  blockerLabel: string;
  urgency: Record<string, null>;
  why: string;
  partial: boolean;
  options: Array<{
    action: string;
    displayLabel: string;
    whyThis: string;
    estimatedDelayIfSkipped: [bigint] | [];
  }>;
}

function extractVariant(v: Record<string, null>): NextStepUrgency {
  const k = Object.keys(v)[0];
  if (k === 'blocking' || k === 'soon' || k === 'later') return k;
  return 'later';
}

function classifyError(err: string): NextStepError {
  switch (err) {
    case 'transaction_not_found':
      return { code: 'not_found', message: 'Transaction not found' };
    case 'access_denied':
      return {
        code: 'access_denied',
        message: 'You do not have access to this transaction',
      };
    case 'anonymous_caller_not_allowed':
      return {
        code: 'anonymous',
        message: 'Sign in to load next-step recommendations',
      };
    default:
      return { code: 'unknown', message: err };
  }
}

async function enrichWithConveyancerPanel(
  base: NextStepRecommendation,
): Promise<NextStepRecommendation> {
  try {
    // Count the firms the panel itself lists: the same table, the same
    // filters and the same test-firm rule as SupabaseProviderDataSource.
    // Counting clc_practices instead gave "(0 firms)" beside a panel that
    // showed two.
    const { data, error } = await supabase
      .from('conveyancer_panel')
      .select('id, is_test')
      .eq('active_on_panel', true)
      .eq('status', 'Active');
    if (error) {
      logger.warn('[next-step] panel-match lookup failed', error.message);
      return base;
    }
    const firms = keepFirmsFor((data ?? []) as Array<{ is_test?: boolean | null }>, await currentUserIsTestAccount());
    const count = firms.length;
    // "(0 firms)" next to "Browse the panel" reads as broken; say nothing instead.
    if (count === 0) return base;
    const options = base.options.map((o) =>
      o.action === 'browse_conveyancer_panel'
        ? { ...o, panelMatchCount: count }
        : o,
    );
    return { ...base, options };
  } catch (err) {
    logger.warn('[next-step] panel-match lookup threw', err);
    return base;
  }
}
