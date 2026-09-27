// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Buyer side of a developer plot invite. The buyer enters the plot's
 * TX-XXXX-XXXX code on the Join screen; these wrap the two SECURITY DEFINER
 * functions from migration 20260927_developer_plot_claim. The buyer has no
 * write access to `plots`, so the claim has to go through the server.
 *
 * Order matters: check first, then create the on-chain deal, then claim.
 * Checking first means a buyer who can't have the plot never creates an
 * orphan deal.
 */

import { supabase } from '@/lib/supabase';
import { icpService } from '@/services/icp.service';
import { logger } from '@/utils/logger';

export type PlotClaimCheck = 'ok' | 'reserved_for_other' | 'taken' | 'not_found';

const CHECK_MESSAGES: Record<Exclude<PlotClaimCheck, 'ok'>, string> = {
  reserved_for_other:
    'This plot is reserved for another buyer. Sign in with the email address the developer reserved it for.',
  taken: 'This plot has already been reserved.',
  not_found: 'We could not find this plot. Please check the invite code.',
};

/** User-facing reason a claim can't go ahead, or null when it can. */
export function plotClaimBlockedReason(check: PlotClaimCheck): string | null {
  return check === 'ok' ? null : CHECK_MESSAGES[check];
}

export async function checkPlotClaim(code: string): Promise<PlotClaimCheck> {
  const { data, error } = await supabase.rpc('check_plot_claim', { p_code: code });
  if (error) {
    throw new Error(`Could not check this plot: ${error.message}`);
  }
  return data as PlotClaimCheck;
}

/**
 * Reserve the plot for the signed-in buyer against their new on-chain deal,
 * then record it on that deal's ledger. The event carries no personal data.
 */
export async function claimPlot(code: string, transactionId: string): Promise<string> {
  const { data, error } = await supabase.rpc('claim_plot', {
    p_code: code,
    p_transaction_id: transactionId,
  });
  if (error) {
    throw new Error(`Could not reserve this plot: ${error.message}`);
  }
  const plotId = data as string;

  void icpService.ledgerManager
    ?.logEvent(
      transactionId,
      'plot_claimed',
      'Buyer claimed the developer plot',
      [JSON.stringify({ plotId })],
    )
    .catch((err: unknown) => logger.warn('[plotClaim] logEvent failed', err));

  return plotId;
}
