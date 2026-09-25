// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * v3 Professional overview aggregation (Ship 6).
 *
 * Pure reducer that rolls up per-transaction signals (reminders, phase,
 * forms status) into a single cross-transaction view for conveyancers,
 * solicitors, and other professionals managing many deals at once.
 *
 * No network calls here — callers supply the transaction records and
 * matched audit events. The fetch orchestration lives on the React
 * component so the reducer stays testable.
 *
 * See docs/Upgrades/propxchain-v3-roadmap.md Phase 6 Task 6.1.
 */

import { generateReminders, type Reminder, type ReminderInput } from './remindersService';
import {
  derivePhase,
  extractMilestonesFromEvents,
  statusIsCompleted,
  statusIsExchanged,
  type Phase,
} from './phase';

type TransactionStatusKey = ReminderInput['status'];

interface AuditEventLike {
  eventType: string;
  timestamp: number;
}

export interface TransactionSnapshot {
  transactionId: string;
  propertyAddress: string;
  buyer: string;
  seller: string;
  status: TransactionStatusKey;
  events: AuditEventLike[];
}

export interface TransactionSummary {
  transactionId: string;
  propertyAddress: string;
  phase: Phase;
  reminders: Reminder[];
  /** Highest urgency across this transaction's reminders ('critical' > ...) */
  topUrgency: Reminder['urgency'] | null;
  /** Boolean flags for the key forms (TA6, TA10, contract signing) */
  formsStatus: {
    sellerFormsComplete: boolean;
    searchesOrdered: boolean;
    contractExchanged: boolean;
    completed: boolean;
  };
}

export interface ProfessionalOverview {
  stats: {
    total: number;
    active: number;
    exchanging: number;
    completing: number;
    completed: number;
  };
  /**
   * Attention items flattened across all transactions — most urgent first,
   * capped so the UI doesn't overflow.
   */
  attention: Array<{ transactionId: string; propertyAddress: string; reminder: Reminder }>;
  /** Per-transaction summaries keyed by id, for table display. */
  transactions: TransactionSummary[];
  /** Count of transactions with each forms step complete. */
  formsTotals: {
    sellerFormsComplete: number;
    searchesOrdered: number;
    contractExchanged: number;
    completed: number;
  };
}

const URGENCY_RANK: Record<Reminder['urgency'], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function hasEvent(events: AuditEventLike[], type: string): boolean {
  for (const e of events) if (e.eventType === type) return true;
  return false;
}

function deriveSummary(snap: TransactionSnapshot, now: number): TransactionSummary {
  const milestones = extractMilestonesFromEvents(snap.events);
  const phase = derivePhase({
    isCompleted: statusIsCompleted({ [snap.status]: null } as Parameters<typeof statusIsCompleted>[0]),
    isExchanged: statusIsExchanged({ [snap.status]: null } as Parameters<typeof statusIsExchanged>[0]),
    buyer: snap.buyer,
    seller: snap.seller,
    milestones,
  });
  const reminders = generateReminders({
    status: snap.status,
    buyer: snap.buyer,
    seller: snap.seller,
    events: snap.events,
    now,
  });
  const topUrgency =
    reminders.length > 0
      ? reminders.reduce<Reminder['urgency']>(
          (top, r) => (URGENCY_RANK[r.urgency] < URGENCY_RANK[top] ? r.urgency : top),
          reminders[0].urgency,
        )
      : null;

  return {
    transactionId: snap.transactionId,
    propertyAddress: snap.propertyAddress,
    phase,
    reminders,
    topUrgency,
    formsStatus: {
      sellerFormsComplete: hasEvent(snap.events, 'seller_forms_completed'),
      searchesOrdered: hasEvent(snap.events, 'searches_ordered'),
      contractExchanged: hasEvent(snap.events, 'contract_exchanged') || snap.status === 'exchanged',
      completed:
        hasEvent(snap.events, 'blockchain_completed') ||
        snap.status === 'blockchain_completed' ||
        snap.status === 'land_registry_registered',
    },
  };
}

/**
 * Build a professional overview from the raw transaction snapshots.
 *
 * - `now` is injectable (ms since epoch) so reminder rules are testable.
 * - `attentionCap` caps how many attention items we return to avoid
 *   overwhelming the UI — default 20. Transactions beyond that still
 *   appear in the main summaries list with their top-urgency badge.
 */
export function buildProfessionalOverview(
  snapshots: TransactionSnapshot[],
  now: number,
  attentionCap: number = 20,
): ProfessionalOverview {
  const summaries = snapshots.map((s) => deriveSummary(s, now));

  const stats = {
    total: summaries.length,
    active: 0,
    exchanging: 0,
    completing: 0,
    completed: 0,
  };
  for (const s of summaries) {
    if (s.phase === 'completed') stats.completed += 1;
    else if (s.phase === 'preCompletion') stats.completing += 1;
    else if (s.phase === 'preContract') stats.exchanging += 1;
    else stats.active += 1;
  }

  const attention: ProfessionalOverview['attention'] = [];
  for (const s of summaries) {
    for (const r of s.reminders) {
      attention.push({
        transactionId: s.transactionId,
        propertyAddress: s.propertyAddress,
        reminder: r,
      });
    }
  }
  attention.sort((a, b) => {
    const byU = URGENCY_RANK[a.reminder.urgency] - URGENCY_RANK[b.reminder.urgency];
    if (byU !== 0) return byU;
    return a.reminder.triggeredAt - b.reminder.triggeredAt;
  });

  const formsTotals = {
    sellerFormsComplete: summaries.filter((s) => s.formsStatus.sellerFormsComplete).length,
    searchesOrdered: summaries.filter((s) => s.formsStatus.searchesOrdered).length,
    contractExchanged: summaries.filter((s) => s.formsStatus.contractExchanged).length,
    completed: summaries.filter((s) => s.formsStatus.completed).length,
  };

  return {
    stats,
    attention: attention.slice(0, attentionCap),
    transactions: summaries,
    formsTotals,
  };
}
