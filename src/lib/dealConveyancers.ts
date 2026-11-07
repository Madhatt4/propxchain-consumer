// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Who is acting on each side of a deal, from the canister's buyerSolicitor and
 * sellerSolicitor slots (card 5de4b8d4). Those slots are the one source: the
 * conveyancer-join service fills them once a client accepts a firm's estimate
 * and the firm joins, and an admin can correct them. The deal page used to
 * read none of it, so a client was never told their firm was on the deal and a
 * joined firm opening the deal was shown the seller's journey.
 *
 * Only the firm name is read for display: the slot holds the firm's
 * registered details, not a person's.
 */
import type { DealSide } from '@/lib/dealAccess';

export interface DealConveyancer {
  principal: string;
  firmName: string | null;
}

export interface DealConveyancers {
  buyer: DealConveyancer | null;
  seller: DealConveyancer | null;
}

export const NO_CONVEYANCERS: DealConveyancers = { buyer: null, seller: null };

/** Candid principals arrive as objects with toText(); tests pass strings. */
function principalText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toText' in value) {
    return String((value as { toText: () => string }).toText());
  }
  return '';
}

/** One slot: a record, a Candid opt (`[] | [record]`), or nothing. */
export function conveyancerOfSlot(slot: unknown): DealConveyancer | null {
  const record: unknown = Array.isArray(slot) ? slot[0] : slot;
  if (!record || typeof record !== 'object' || !('principal' in record)) return null;
  const principal = principalText((record as { principal: unknown }).principal);
  if (!principal) return null;
  const firm = (record as { firmName?: unknown }).firmName;
  return { principal, firmName: typeof firm === 'string' && firm.trim() ? firm.trim() : null };
}

export function dealConveyancersOf(tx: { buyerSolicitor?: unknown; sellerSolicitor?: unknown } | null | undefined): DealConveyancers {
  if (!tx) return NO_CONVEYANCERS;
  return { buyer: conveyancerOfSlot(tx.buyerSolicitor), seller: conveyancerOfSlot(tx.sellerSolicitor) };
}

/**
 * The side `principal` is the assigned conveyancer for, or null. A firm on
 * both slots speaks for neither, as in the canister's Sides.assignedSide.
 */
export function conveyancerSideOf(c: DealConveyancers, principal: string | null | undefined): 'buyer' | 'seller' | null {
  if (!principal) return null;
  const isBuyer = c.buyer?.principal === principal;
  const isSeller = c.seller?.principal === principal;
  if (isBuyer === isSeller) return null;
  return isBuyer ? 'buyer' : 'seller';
}

/**
 * Where a firm opening a client's deal page belongs: its matter page in the
 * conveyancer workspace, which says which side it acts for. Null for anyone
 * who is a party (or a party's delegate) on the deal, who keeps the page.
 */
export function conveyancerMatterPath(
  transactionId: string | undefined,
  conveyancerSide: 'buyer' | 'seller' | null,
  dealSide: DealSide,
): string | null {
  if (!transactionId || !conveyancerSide || dealSide !== 'other') return null;
  return `/pro/conveyancer/matters/${encodeURIComponent(transactionId)}`;
}

function firmOf(c: DealConveyancer | null): string | null {
  if (!c) return null;
  return c.firmName ?? 'a firm on the PropXchain panel';
}

/**
 * The plain lines the deal page shows: the viewer's own side first, then the
 * other side's once it has a firm. Anyone not on a side (the agent) sees
 * whichever sides have one. Empty when there is nothing to say.
 */
export function conveyancerLines(c: DealConveyancers, viewer: DealSide, hasBuyer: boolean): string[] {
  const seller = firmOf(c.seller);
  const buyer = firmOf(c.buyer);
  if (viewer === 'seller' || viewer === 'buyer') {
    const own = viewer === 'seller' ? seller : buyer;
    const other = viewer === 'seller' ? buyer : seller;
    const otherLabel = viewer === 'seller' ? "The buyer's conveyancer" : "The seller's conveyancer";
    const lines = [own ? `Your conveyancer: ${own}` : 'Your conveyancer: not instructed yet'];
    if (other && (viewer === 'buyer' || hasBuyer)) lines.push(`${otherLabel}: ${other}`);
    return lines;
  }
  const lines: string[] = [];
  if (seller) lines.push(`The seller's conveyancer: ${seller}`);
  if (buyer && hasBuyer) lines.push(`The buyer's conveyancer: ${buyer}`);
  return lines;
}
