// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import type { DealParties } from './dealAccess';

/**
 * Who may confirm keys released, mirroring transaction_manager's rule: the
 * seller's estate agent (anyone holding a mandate from a seller party), or
 * the seller only when the seller has no agent. The canister has the final
 * say; this only decides whether to offer the button.
 *
 * - agent: acts for a seller party, may confirm.
 * - seller: a seller party with no agent, may confirm.
 * - seller-with-agent: a seller party whose agent confirms instead.
 * - none: anyone else (buyer side, strangers).
 */
export type KeysRole = 'agent' | 'seller' | 'seller-with-agent' | 'none';

/**
 * True when the viewer is a buyer or seller party in their own right, not a
 * delegate. Only a party (with no conveyancer acting) gets a money button;
 * an estate agent or other delegate never confirms completion funds.
 * `buyer === seller` is the canister's "no buyer yet" placeholder.
 */
export function isDealParty(parties: DealParties, principal: string | null | undefined): boolean {
  if (!principal) return false;
  const { seller, buyer, sellers = [], buyers = [] } = parties;
  if (principal === seller || sellers.includes(principal)) return true;
  const hasBuyer = Boolean(buyer) && buyer !== seller;
  return (hasBuyer && principal === buyer) || buyers.includes(principal);
}

export function keysRoleOf(parties: DealParties, principal: string | null | undefined): KeysRole {
  if (!principal) return 'none';
  const sellerParties = new Set(
    [parties.seller, ...(parties.sellers ?? [])].filter((p): p is string => Boolean(p)),
  );
  const sellerAgents = (parties.delegates ?? [])
    .filter(([party]) => sellerParties.has(party))
    .map(([, delegate]) => delegate);
  if (sellerParties.has(principal)) {
    return sellerAgents.length > 0 ? 'seller-with-agent' : 'seller';
  }
  return sellerAgents.includes(principal) ? 'agent' : 'none';
}
