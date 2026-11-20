// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The viewer's buyer-invite state for a deal (lib/buyerInvite), read from the
 * chain. A failed read never shows the code: it reports `unavailable`.
 */
import { useDealParties } from '@/hooks/useDealSide';
import { buyerInviteState, type BuyerInviteState } from '@/lib/buyerInvite';

export type BuyerInviteView = BuyerInviteState | 'loading' | 'unavailable';

export function useBuyerInviteState(transactionId: string | null | undefined): BuyerInviteView {
  const { parties, principal, isPending, isError } = useDealParties(transactionId);
  if (isError) return 'unavailable';
  if (!principal || isPending) return 'loading';
  return parties ? buyerInviteState(parties, principal) : 'unavailable';
}
