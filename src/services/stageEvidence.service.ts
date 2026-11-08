// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Reads the evidence src/lib/stageEvidence.ts turns into stage ticks. Every
 * read is independent and a failed one counts as "no evidence", never as an
 * error: a tick that cannot be confirmed stays as the flow state has it.
 */
import { icpService } from './icp.service';
import { loadBuyerPack, type BuyerPackItemId, type BuyerPackStatus } from './buyerPack.service';
import { searchOrderService } from './searchOrder.service';
import type { StageEvidence } from '@/lib/stageEvidence';

const ORDERED_SEARCH_STATUSES: readonly string[] = ['ordered', 'in_progress', 'completed'];

// A thunk, so a read that throws before it returns a promise is caught too.
async function orNull<T>(read: () => Promise<T> | T): Promise<T | null> {
  try { return await read(); } catch { return null; }
}

/** The deal's stage evidence; any read that fails contributes nothing. */
export async function loadStageEvidence(transactionId: string): Promise<StageEvidence> {
  const [events, orders, ta6, ta10, listing, pack] = await Promise.all([
    orNull(() => icpService.ledgerManager?.getEventsByTransaction(transactionId)),
    orNull(() => searchOrderService.getOrdersForTransaction(transactionId)),
    orNull(() => icpService.getTA6(transactionId)),
    orNull(() => icpService.getTA10(transactionId)),
    orNull(() => icpService.getListingData(transactionId)),
    orNull(() => loadBuyerPack(transactionId)),
  ]);
  const eventTypes = new Set<string>();
  for (const e of (Array.isArray(events) ? events : []) as Array<{ eventType?: unknown }>) {
    if (typeof e.eventType === 'string') eventTypes.add(e.eventType);
  }
  const packMap = new Map<BuyerPackItemId, BuyerPackStatus>();
  for (const item of Array.isArray(pack) ? pack : []) packMap.set(item.item, item.status);
  return {
    eventTypes,
    hasOrderedSearches: (Array.isArray(orders) ? orders : []).some((o) => ORDERED_SEARCH_STATUSES.includes(o.status)),
    hasPropertyForms: ta6 != null && ta10 != null,
    hasListing: listing != null,
    pack: packMap,
  };
}
