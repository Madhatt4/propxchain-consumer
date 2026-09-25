// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * docHistory — the one quiet history line under a Transaction Wallet document
 * (wallet spec decision 17): "Shared with X 3 Aug · Revoked 10 Aug". Latest
 * three events, oldest → newest. QR proofs appear as "QR shown 12 Aug (2 views)".
 */
import type { ShareGrant } from '@/services/documentShare.service';
import type { ProofLink } from '@/services/walletProof.service';

interface HistoryEvent {
  at: string;
  text: string;
}

const short = (p: string): string => `${p.slice(0, 8)}…${p.slice(-5)}`;
const day = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export function buildDocHistory(
  grants: ShareGrant[],
  docHash: string,
  labelFor: (principal: string) => string | undefined,
  proofs: ProofLink[] = [],
  max = 3,
): string {
  const events: HistoryEvent[] = [];
  const prefix = docHash.slice(0, 12);
  for (const link of proofs) {
    if (!link.items.some((i) => i.hashPrefix === prefix)) continue;
    const views = link.viewCount === 1 ? '1 view' : `${link.viewCount} views`;
    events.push({ at: link.createdAt, text: `QR shown ${day(link.createdAt)} (${views})` });
  }
  for (const g of grants) {
    if (g.docHash !== docHash) continue;
    const who = labelFor(g.granteePrincipal) ?? short(g.granteePrincipal);
    events.push({ at: g.createdAt, text: `Shared with ${who} ${day(g.createdAt)}` });
    if (g.status === 'revoked' && g.revokedAt) {
      events.push({ at: g.revokedAt, text: `Revoked ${day(g.revokedAt)}` });
    }
  }
  events.sort((a, b) => a.at.localeCompare(b.at));
  return events.slice(-max).map((e) => e.text).join(' · ');
}
