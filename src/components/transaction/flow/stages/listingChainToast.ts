// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The toast shown when a listing save reached this device but not the chain.
 * Shared by Stage 1 and the Sales pack's inline form so a seller sees the
 * same warning whichever place they saved from.
 */
export interface ListingChainToast {
  title: string;
  description: string;
  variant: 'destructive';
}

export function listingChainFailedToast(error?: string): ListingChainToast {
  return {
    title: 'Saved on this device — blockchain sync failed',
    description:
      'Your property details are saved locally but could not be written on-chain, '
      + 'so they may not reach the buyer until you save again.'
      + (error ? ` (${error})` : ''),
    variant: 'destructive',
  };
}
