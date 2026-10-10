// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Delete, Leave or nothing — what the dashboard offers to take a deal off
 * someone's list. It has to match what the transaction canister will accept,
 * or the button is a promise the canister then refuses:
 *
 *  - deleteTransaction accepts only a seller party: the seller slot or anyone
 *    on the multi-party `sellers` list (Sides.isSellerParty).
 *  - leaveTransaction refuses every seller party, and refuses the creator
 *    unless they are the assigned buyer (an agent who started the sale keeps
 *    it, even after handing the seller slot to the real seller).
 *
 * Delegates are deliberately left out. The access matrix puts a delegate on
 * the side of the party they act for, but isSellerParty ignores delegates, so
 * a seller's delegate must never be offered Delete.
 */
import { canAct, dealSideOf, type DealParties } from './dealAccess';

export type RemoveAction = 'delete' | 'leave' | 'none';

/** The transaction fields the decision reads, as the dashboard holds them. */
export interface RemovableDeal {
  seller?: string | null;
  buyer?: string | null;
  createdBy?: string | null;
  sellers?: ReadonlyArray<{ principal: string }>;
  buyers?: ReadonlyArray<{ principal: string }>;
  /** Accepted so a caller can pass a richer object; never consulted. */
  delegates?: DealParties['delegates'];
}

function partiesOf(tx: RemovableDeal): DealParties {
  return {
    seller: tx.seller,
    buyer: tx.buyer,
    sellers: (tx.sellers ?? []).map((p) => p.principal),
    buyers: (tx.buyers ?? []).map((p) => p.principal),
  };
}

/** True for the seller slot or anyone on the sellers list — the canister's isSellerParty. */
export function isSellerParty(tx: RemovableDeal, principal: string | null | undefined): boolean {
  if (!principal) return false;
  return dealSideOf(partiesOf(tx), principal) === 'seller';
}

/**
 * True for anyone holding a buyer or seller slot, or on either list. A
 * conveyancer who is also buying or selling a home of their own opens that
 * deal as a party, not on the conveyancer matter screen.
 */
export function isDealParty(tx: RemovableDeal, principal: string | null | undefined): boolean {
  if (!principal) return false;
  return dealSideOf(partiesOf(tx), principal) !== 'other';
}

/** Which removal the canister will accept from `principal` on this deal. */
export function removeActionFor(tx: RemovableDeal, principal: string | null | undefined): RemoveAction {
  if (!principal) return 'none';
  if (canAct('deleteDeal', dealSideOf(partiesOf(tx), principal))) return 'delete';
  // Until a buyer joins the canister parks the seller in the buyer slot.
  const isAssignedBuyer = principal === tx.buyer && tx.buyer !== tx.seller;
  if (principal === tx.createdBy && !isAssignedBuyer) return 'none';
  return 'leave';
}
