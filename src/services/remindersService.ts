// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * v3 Reminders engine (Ship 4b).
 *
 * Pure rules engine that takes a transaction snapshot + audit event
 * stream + the current time and returns a list of active reminders.
 * Every rule is "if X happened >N days ago AND Y didn't happen yet,
 * emit reminder with urgency U". No network calls, no canister state.
 *
 * Mirrors the 3f cross-reference pattern: deterministic rules engine
 * + display component. Rules are a condensed subset of the v3 roadmap
 * Task 4.3 spec — only rules we can express from the audit events the
 * canister already emits (Ship 2c).
 *
 * See docs/Upgrades/propxchain-v3-roadmap.md Phase 4 Task 4.3.
 */

export type ReminderUrgency = 'low' | 'medium' | 'high' | 'critical';

export interface Reminder {
  id: string;
  urgency: ReminderUrgency;
  message: string;
  suggestedAction: string;
  /** Timestamp (ms) of the event that triggered this reminder — helps the UI sort. */
  triggeredAt: number;
  /** Human-readable explanation of what fired the rule. */
  source: string;
}

interface AuditEventLike {
  eventType: string;
  timestamp: number;
}

export interface ReminderInput {
  /** Transaction status — drives some post-exchange rules. */
  status:
    | 'active'
    | 'exchanged'
    | 'completion_initiated'
    | 'blockchain_completed'
    | 'land_registry_registered';
  buyer: string;
  seller: string;
  events: AuditEventLike[];
  /** Current time (ms since epoch). Injectable for testing. */
  now: number;
}

// ============================================
// Rule helpers
// ============================================

const DAY_MS = 24 * 60 * 60 * 1000;

function firstEvent(events: AuditEventLike[], type: string): AuditEventLike | null {
  let earliest: AuditEventLike | null = null;
  for (const e of events) {
    if (e.eventType === type && (earliest === null || e.timestamp < earliest.timestamp)) {
      earliest = e;
    }
  }
  return earliest;
}

function hasEvent(events: AuditEventLike[], type: string): boolean {
  return firstEvent(events, type) !== null;
}

function daysBetween(then: number, now: number): number {
  return Math.max(0, Math.floor((now - then) / DAY_MS));
}

// ============================================
// Rules
// ============================================

type Rule = (input: ReminderInput) => Reminder | null;

function ruleSellerSolicitor(input: ReminderInput): Reminder | null {
  const created = firstEvent(input.events, 'transaction_created');
  if (!created) return null;
  const days = daysBetween(created.timestamp, input.now);
  if (days < 2) return null;
  if (hasEvent(input.events, 'seller_conveyancer_confirmed')) return null;
  return {
    id: 'seller-solicitor-delay',
    urgency: 'high',
    message: `Seller solicitor not appointed (${days} days since listing).`,
    suggestedAction: 'Instruct a conveyancing solicitor to avoid stalling the transaction.',
    triggeredAt: created.timestamp,
    source: 'transaction_created',
  };
}

function ruleSellerForms(input: ReminderInput): Reminder | null {
  const created = firstEvent(input.events, 'transaction_created');
  if (!created) return null;
  const days = daysBetween(created.timestamp, input.now);
  if (days < 7) return null;
  if (hasEvent(input.events, 'seller_forms_completed')) return null;
  return {
    id: 'seller-forms-delay',
    urgency: 'medium',
    message: `TA6 / TA10 seller forms not completed (${days} days since listing).`,
    suggestedAction: 'Complete the TA6 and TA10 forms so the contract pack can be sent.',
    triggeredAt: created.timestamp,
    source: 'transaction_created',
  };
}

function ruleBuyerSolicitor(input: ReminderInput): Reminder | null {
  const joined = firstEvent(input.events, 'buyer_joined');
  if (!joined) return null;
  const days = daysBetween(joined.timestamp, input.now);
  if (days < 3) return null;
  if (hasEvent(input.events, 'buyer_conveyancer_confirmed')) return null;
  return {
    id: 'buyer-solicitor-delay',
    urgency: 'high',
    message: `Buyer solicitor not appointed (${days} days since buyer joined).`,
    suggestedAction: 'Instruct a conveyancing solicitor to order searches and review the pack.',
    triggeredAt: joined.timestamp,
    source: 'buyer_joined',
  };
}

function ruleBuyerMortgage(input: ReminderInput): Reminder | null {
  const joined = firstEvent(input.events, 'buyer_joined');
  if (!joined) return null;
  const days = daysBetween(joined.timestamp, input.now);
  if (days < 14) return null;
  if (hasEvent(input.events, 'mortgage_confirmed')) return null;
  return {
    id: 'buyer-mortgage-delay',
    urgency: 'medium',
    message: `Mortgage not confirmed (${days} days since buyer joined).`,
    suggestedAction: 'Submit the mortgage application and obtain an offer — skip if cash buyer.',
    triggeredAt: joined.timestamp,
    source: 'buyer_joined',
  };
}

function ruleSearches(input: ReminderInput): Reminder | null {
  const joined = firstEvent(input.events, 'buyer_joined');
  if (!joined) return null;
  const days = daysBetween(joined.timestamp, input.now);
  if (days < 5) return null;
  if (hasEvent(input.events, 'searches_ordered')) return null;
  return {
    id: 'searches-delay',
    urgency: 'high',
    message: `Property searches not ordered (${days} days since buyer joined).`,
    suggestedAction: 'Order Local Authority, Water & Drainage, and Environmental searches now.',
    triggeredAt: joined.timestamp,
    source: 'buyer_joined',
  };
}

function ruleSurvey(input: ReminderInput): Reminder | null {
  const joined = firstEvent(input.events, 'buyer_joined');
  if (!joined) return null;
  const days = daysBetween(joined.timestamp, input.now);
  if (days < 14) return null;
  if (hasEvent(input.events, 'survey_completed')) return null;
  return {
    id: 'survey-delay',
    urgency: 'low',
    message: `No survey recorded (${days} days since buyer joined).`,
    suggestedAction: 'Book a survey if planning one — it can be the bottleneck to exchange.',
    triggeredAt: joined.timestamp,
    source: 'buyer_joined',
  };
}

function ruleCompletionDelay(input: ReminderInput): Reminder | null {
  const exchanged = firstEvent(input.events, 'contract_exchanged');
  if (!exchanged) return null;
  const days = daysBetween(exchanged.timestamp, input.now);
  if (days < 14) return null;
  if (
    input.status === 'blockchain_completed' ||
    input.status === 'land_registry_registered' ||
    hasEvent(input.events, 'blockchain_completed')
  ) {
    return null;
  }
  const urgency: ReminderUrgency = days >= 30 ? 'high' : 'medium';
  return {
    id: 'completion-delay',
    urgency,
    message: `Exchange happened ${days} days ago but completion is not recorded.`,
    suggestedAction: 'Confirm the completion date with both solicitors and record completion on-chain.',
    triggeredAt: exchanged.timestamp,
    source: 'contract_exchanged',
  };
}

function ruleLandRegistryDelay(input: ReminderInput): Reminder | null {
  const completed = firstEvent(input.events, 'blockchain_completed');
  if (!completed) return null;
  const days = daysBetween(completed.timestamp, input.now);
  if (days < 7) return null;
  if (hasEvent(input.events, 'lr_submission')) return null;
  return {
    id: 'lr-submission-delay',
    urgency: 'high',
    message: `Completion was ${days} days ago — Land Registry application not submitted.`,
    suggestedAction: 'Submit the AP1 / TR1 to Land Registry before the OS1 priority window lapses.',
    triggeredAt: completed.timestamp,
    source: 'blockchain_completed',
  };
}

function ruleSdltDeadline(input: ReminderInput): Reminder | null {
  const completed = firstEvent(input.events, 'blockchain_completed');
  if (!completed) return null;
  const days = daysBetween(completed.timestamp, input.now);
  if (days < 10) return null;
  // SDLT deadline is 14 calendar days after completion. Ramp urgency as it gets closer.
  let urgency: ReminderUrgency;
  if (days >= 14) urgency = 'critical';
  else if (days >= 12) urgency = 'critical';
  else urgency = 'high';
  return {
    id: 'sdlt-deadline',
    urgency,
    message: `SDLT return due — ${Math.max(0, 14 - days)} days remaining before HMRC penalties.`,
    suggestedAction: 'File the SDLT return and pay the duty now if not already done.',
    triggeredAt: completed.timestamp,
    source: 'blockchain_completed',
  };
}

const RULES: Rule[] = [
  ruleSellerSolicitor,
  ruleSellerForms,
  ruleBuyerSolicitor,
  ruleBuyerMortgage,
  ruleSearches,
  ruleSurvey,
  ruleCompletionDelay,
  ruleLandRegistryDelay,
  ruleSdltDeadline,
];

// ============================================
// Public API
// ============================================

const URGENCY_ORDER: Record<ReminderUrgency, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Generate the active reminders for a transaction. Returns them sorted
 * by urgency (critical first), then by how long ago the triggering event
 * happened (oldest first — more stale = more worrying).
 */
export function generateReminders(input: ReminderInput): Reminder[] {
  const results: Reminder[] = [];
  for (const rule of RULES) {
    const r = rule(input);
    if (r) results.push(r);
  }
  return results.sort((a, b) => {
    const byUrgency = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
    if (byUrgency !== 0) return byUrgency;
    return a.triggeredAt - b.triggeredAt;
  });
}
