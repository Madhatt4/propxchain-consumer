// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Whether the viewer may hand out the deal's invite code (Marc, 2026-11-19).
 *
 * The code is the buyer's way in only: the seller side gives it to the buyer,
 * using it makes you the buyer, and then it is used up. Estate agents are
 * invited from "Add your estate agent" on the deal page and conveyancers join
 * through an accepted estimate, so neither is ever sent the code. Who counts
 * as the seller side is the deal access map's `buyerInvite` row, the same rule
 * the deal page's BuyerInviteCard follows.
 */
import { canAct, dealSideOf, type DealParties } from '@/lib/dealAccess';

export type BuyerInviteState = 'share' | 'buyerJoined' | 'notSellerSide';

/** Until a buyer joins, the canister keeps the seller in the buyer slot too. */
export function hasBuyerJoined(parties: DealParties): boolean {
  const { seller, buyer, buyers = [] } = parties;
  return (Boolean(buyer) && buyer !== seller) || buyers.length > 0;
}

export function buyerInviteState(parties: DealParties, principal: string | null | undefined): BuyerInviteState {
  if (!canAct('buyerInvite', dealSideOf(parties, principal))) return 'notSellerSide';
  return hasBuyerJoined(parties) ? 'buyerJoined' : 'share';
}
