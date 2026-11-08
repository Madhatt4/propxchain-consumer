// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Which flow stages are done, from evidence every party on the deal can read
 * (Marc, 2026-11-08: "when an item is uploaded or a stage completed it needs
 * to be marked done").
 *
 * Why not the flow-state blob alone: it is one JSON value per deal, read once
 * on load and rewritten whole, so a second party's write drops the first's
 * tick, and a failed chain write keeps the tick on one device only. The
 * canister milestones the hook maps are never returned. The evidence below is
 * append-only or owned by the server, so a tick cannot be lost.
 */
import type { BuyerPackItemId, BuyerPackStatus } from '@/services/buyerPack.service';

export interface StageEvidence {
  /** eventType of every ledger event on the deal. completeStage writes one per stage. */
  eventTypes: ReadonlySet<string>;
  /** A search order is ordered, in progress or completed. */
  hasOrderedSearches: boolean;
  /** TA6 and TA10 are both on chain. */
  hasPropertyForms: boolean;
  /** The listing is saved on chain. */
  hasListing: boolean;
  /** Buyer pack item statuses, as the server reports them. */
  pack: ReadonlyMap<BuyerPackItemId, BuyerPackStatus>;
}

export const NO_EVIDENCE: StageEvidence = {
  eventTypes: new Set(),
  hasOrderedSearches: false,
  hasPropertyForms: false,
  hasListing: false,
  pack: new Map(),
};

/** Stage ids the evidence shows as done. Each rule mirrors that stage's own panel. */
export function stagesDoneByEvidence(e: StageEvidence): Set<string> {
  const done = new Set<string>();
  const has = (eventType: string): boolean => e.eventTypes.has(eventType);
  if (e.hasListing) done.add('seller-1');
  if (e.hasOrderedSearches || has('searches_ordered')) done.add('seller-2');
  if (e.hasPropertyForms || has('seller_forms_completed')) done.add('seller-3');
  // MortgageFundingStage completes only once the mortgage item reads ready.
  if (e.pack.get('mortgage') === 'ready' || has('mortgage_confirmed')) done.add('buyer-2');
  // A survey booked (in progress) or received (ready) is the stage's action done.
  const survey = e.pack.get('survey');
  if (survey === 'in_progress' || survey === 'ready' || has('survey_completed')) done.add('buyer-3');
  if (has('sellers_pack_reviewed')) done.add('buyer-4');
  return done;
}
