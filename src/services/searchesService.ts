// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * v3 Searches tracking service (Ship 4c).
 *
 * Pure derivation of per-search status from the audit event stream.
 * Frontend-only — same pattern as phase, reminders, cross-reference.
 * Doesn't create or consume any new canister methods.
 *
 * The canister today fires a single `searches_ordered` event when the
 * buyer commits to the seller-2 stage. We can't distinguish between
 * individual search types from that event alone, so the tracking is
 * coarse: once `searches_ordered` fires, every standard search transitions
 * from "not ordered" to "ordered / in flight" with its expected return
 * window calculated from typical conveyancing turnarounds.
 *
 * Ship 4.2 of the original roadmap proposed a dedicated canister; we
 * defer that until per-search-type audit events or flowState integration
 * is actually required. See docs/Upgrades/propxchain-v3-roadmap.md Phase
 * 4 Task 4.2.
 */

export type SearchStatus = 'notOrdered' | 'ordered' | 'expiringSoon' | 'expired';

export interface SearchDefinition {
  id: string;
  label: string;
  /** Short blurb shown in the UI */
  description: string;
  /** Typical time (days) from order to receipt */
  typicalReturnDays: number;
  /** Validity window (days) from receipt before the buyer has to re-order */
  validityDays: number;
  /** Conditional: only required under some circumstances — text explains when */
  conditional?: string;
}

export interface SearchState extends SearchDefinition {
  status: SearchStatus;
  /** When `searches_ordered` fired for this transaction, if at all */
  orderedAt: number | null;
  /** Estimated arrival date (orderedAt + typicalReturnDays). null if not ordered. */
  expectedBy: number | null;
  /** Estimated expiry date (orderedAt + typicalReturnDays + validityDays). null if not ordered. */
  expiresAt: number | null;
  /** Days remaining until expiresAt. null if not ordered or already expired. */
  daysUntilExpiry: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRING_SOON_THRESHOLD_DAYS = 30;

// ============================================
// Static definitions (UK conveyancing)
// ============================================

export const SEARCH_DEFINITIONS: SearchDefinition[] = [
  {
    id: 'local-authority',
    label: 'Local Authority (LLC1 + CON29R)',
    description:
      'Registered charges, planning history, building regs, highways, public rights of way.',
    typicalReturnDays: 21, // 3 weeks is typical, some councils faster
    validityDays: 180, // 6 months
  },
  {
    id: 'water-drainage',
    label: 'Water & Drainage (CON29DW)',
    description: 'Mains water + sewer connection, public sewers crossing the land.',
    typicalReturnDays: 10,
    validityDays: 180,
  },
  {
    id: 'environmental',
    label: 'Environmental',
    description: 'Contaminated land, flood risk, ground stability, energy + infrastructure.',
    typicalReturnDays: 2,
    validityDays: 180,
  },
  {
    id: 'chancel',
    label: 'Chancel',
    description: 'Chancel repair liability (medieval land obligations).',
    typicalReturnDays: 2,
    validityDays: 180,
  },
  {
    id: 'coal-mining',
    label: 'Coal Mining',
    description: 'Past and future coal mining hazards.',
    typicalReturnDays: 2,
    validityDays: 180,
    conditional: 'Only required in former coal mining areas (CA1 authority regions).',
  },
  {
    id: 'os1-priority',
    label: 'OS1 Priority Search',
    description: 'Pre-completion Land Registry priority protection (30 working days).',
    typicalReturnDays: 1,
    validityDays: 42, // ~30 working days
    conditional: 'Ordered by the buyer solicitor pre-completion, after exchange.',
  },
  {
    id: 'k16-bankruptcy',
    label: 'K16 Bankruptcy',
    description: 'Individual insolvency check against the borrower (if mortgaged).',
    typicalReturnDays: 1,
    validityDays: 42,
    conditional: 'Only required where the buyer is taking a mortgage.',
  },
];

// ============================================
// Derivation
// ============================================

interface AuditEventLike {
  eventType: string;
  timestamp: number;
}

function firstOrderedTimestamp(events: AuditEventLike[]): number | null {
  let earliest: number | null = null;
  for (const e of events) {
    if (e.eventType === 'searches_ordered') {
      if (earliest === null || e.timestamp < earliest) earliest = e.timestamp;
    }
  }
  return earliest;
}

function deriveStatus(
  orderedAt: number | null,
  expectedBy: number | null,
  expiresAt: number | null,
  now: number,
): SearchStatus {
  if (orderedAt === null) return 'notOrdered';
  if (expiresAt !== null && now >= expiresAt) return 'expired';
  if (expiresAt !== null && expiresAt - now <= EXPIRING_SOON_THRESHOLD_DAYS * DAY_MS) {
    return 'expiringSoon';
  }
  // Between ordered and expiry, no distinction in this MVP —
  // we don't have a per-search receivedDate event to say "received".
  void expectedBy;
  return 'ordered';
}

/**
 * Derive per-search state for the current transaction. Every search from
 * SEARCH_DEFINITIONS is returned — callers can filter by `.conditional`
 * based on whether mortgage / coal-mining region applies.
 */
export function deriveSearchesState(events: AuditEventLike[], now: number): SearchState[] {
  const orderedAt = firstOrderedTimestamp(events);

  return SEARCH_DEFINITIONS.map((def) => {
    let expectedBy: number | null = null;
    let expiresAt: number | null = null;
    if (orderedAt !== null) {
      expectedBy = orderedAt + def.typicalReturnDays * DAY_MS;
      expiresAt = expectedBy + def.validityDays * DAY_MS;
    }
    const status = deriveStatus(orderedAt, expectedBy, expiresAt, now);
    const daysUntilExpiry =
      expiresAt !== null && expiresAt > now
        ? Math.max(0, Math.floor((expiresAt - now) / DAY_MS))
        : null;

    return {
      ...def,
      status,
      orderedAt,
      expectedBy,
      expiresAt,
      daysUntilExpiry,
    };
  });
}

/** Number of searches that have moved past "notOrdered". */
export function orderedCount(states: SearchState[]): number {
  return states.filter((s) => s.status !== 'notOrdered').length;
}

/**
 * Earliest-expiring date across all ordered searches (the "search validity"
 * commonly referenced by solicitors — must complete before this date).
 */
export function earliestExpiry(states: SearchState[]): number | null {
  let earliest: number | null = null;
  for (const s of states) {
    if (s.expiresAt !== null && (earliest === null || s.expiresAt < earliest)) {
      earliest = s.expiresAt;
    }
  }
  return earliest;
}
