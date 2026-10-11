// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * How old the deal's searches are, against the lender limit.
 *
 * UK Finance Mortgage Lenders' Handbook 5.4.3: searches must be no more than
 * six months old at completion, dated from the original search (a refresh
 * buys fresher information, not a new window). Warn at four months, which
 * leaves about two to re-order (turnaround is two to eight weeks).
 *
 * The same thresholds as the monitor's search-age watch in the monorepo
 * (supabase/functions/transaction-monitor/search-age-rule.ts), which emails
 * and rings the bell; this is what every party sees on the page. Dated from
 * the earliest on-chain `searches_ordered` event, which every member of the
 * deal can read.
 */

export const SEARCH_AGEING_DAYS = 122;
export const SEARCH_EXPIRED_DAYS = 183;
const DAY_MS = 86_400_000;

export type SearchAgeState = 'ok' | 'ageing' | 'expired';

export interface SearchAge {
  state: SearchAgeState;
  ageDays: number;
  /** Days left before the six-month limit; 0 once expired. */
  daysLeft: number;
  orderedAt: number;
}

interface AuditEventLike {
  eventType: string;
  timestamp: number;
}

/** Ledger timestamps are nanoseconds; anything past year 2100 in ms is ns. */
export function toMillis(ts: number): number {
  return ts > 4_102_444_800_000 ? Math.floor(ts / 1_000_000) : ts;
}

/** null until searches are ordered. */
export function searchAgeFromEvents(events: AuditEventLike[], now: number): SearchAge | null {
  let orderedAt: number | null = null;
  for (const e of events) {
    if (e.eventType !== 'searches_ordered') continue;
    const t = toMillis(e.timestamp);
    if (t > 0 && (orderedAt === null || t < orderedAt)) orderedAt = t;
  }
  if (orderedAt === null) return null;
  const ageDays = Math.max(0, Math.floor((now - orderedAt) / DAY_MS));
  const state: SearchAgeState =
    ageDays >= SEARCH_EXPIRED_DAYS ? 'expired' : ageDays >= SEARCH_AGEING_DAYS ? 'ageing' : 'ok';
  return { state, ageDays, daysLeft: Math.max(0, SEARCH_EXPIRED_DAYS - ageDays), orderedAt };
}

export function describeSearchAge(age: SearchAge): string {
  if (age.state === 'expired') {
    return `Searches are ${age.ageDays} days old, past the six months lenders accept at completion. Fresh searches are needed before a mortgage completion.`;
  }
  return `Searches are ${age.ageDays} days old and pass the six-month lender limit in ${age.daysLeft} days. If completion could slip past that, order fresh searches now.`;
}
