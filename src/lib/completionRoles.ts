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
