// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * v3 Phase Checklist (Ship 4a).
 *
 * Static per-phase checklist definitions + a derivation function that marks
 * items completed based on the audit event stream. Pure, testable, no
 * canister dependencies. Pairs with the existing PhaseIndicator — phase
 * tells you where you are, checklist tells you what's left.
 *
 * Item definitions are deliberately coarse (3–5 per phase). The goal is a
 * user-facing nudge list, not a solicitor's exhaustive todo. See
 * docs/Upgrades/propxchain-v3-roadmap.md Phase 4 Task 4.1 for the fuller
 * 40-item list — we intentionally show a condensed version here.
 */

import type { Phase } from './phase';

export interface ChecklistItem {
  id: string;
  label: string;
  /** Event types that mark this item as complete. Any match = done. */
  completedByEvents: string[];
}

export interface ChecklistItemState extends ChecklistItem {
  completed: boolean;
  /** Timestamp (ms) of the earliest matching event, if any. */
  completedAt: number | null;
}

export interface PhaseChecklistState {
  phase: Phase;
  items: ChecklistItemState[];
  /** 0..1 ratio of completed items */
  progress: number;
}

// ============================================
// Static definitions
// ============================================

const DEFINITIONS: Record<Phase, ChecklistItem[]> = {
  sellerPrep: [
    {
      id: 'property-listed',
      label: 'Property listed with full details',
      completedByEvents: ['transaction_created'],
    },
    {
      id: 'seller-solicitor',
      label: 'Seller solicitor instructed',
      completedByEvents: ['seller_conveyancer_confirmed', 'provider_selected'],
    },
    {
      id: 'seller-forms',
      label: 'TA6 / TA10 completed',
      completedByEvents: ['seller_forms_completed'],
    },
    {
      id: 'documents-uploaded',
      label: 'Title + EPC documents uploaded',
      completedByEvents: ['document_uploaded'],
    },
  ],
  buyerSetup: [
    {
      id: 'buyer-joined',
      label: 'Buyer joined the transaction',
      completedByEvents: ['buyer_joined'],
    },
    {
      id: 'buyer-onboarded',
      label: 'Buyer onboarding complete (ID + AML)',
      completedByEvents: ['buyer_onboarded'],
    },
    {
      id: 'buyer-solicitor',
      label: 'Buyer solicitor instructed',
      completedByEvents: ['buyer_conveyancer_confirmed'],
    },
    {
      id: 'mortgage',
      label: 'Mortgage confirmed (or cash position)',
      completedByEvents: ['mortgage_confirmed'],
    },
  ],
  searches: [
    {
      id: 'searches-ordered',
      label: 'Property searches ordered',
      completedByEvents: ['searches_ordered'],
    },
    {
      id: 'survey',
      label: 'Survey complete',
      completedByEvents: ['survey_completed'],
    },
    {
      id: 'seller-pack-review',
      label: 'Buyer reviewed seller pack',
      completedByEvents: ['sellers_pack_reviewed'],
    },
  ],
  preContract: [
    {
      id: 'enquiries',
      label: 'Enquiries resolved',
      completedByEvents: ['enquiries_resolved'],
    },
    {
      id: 'contract-signed',
      label: 'Contract signed by both parties',
      completedByEvents: ['party_signature'],
    },
    {
      id: 'exchange-ready',
      label: 'Ready to exchange',
      completedByEvents: ['contract_exchanged'],
    },
  ],
  preCompletion: [
    {
      id: 'exchanged',
      label: 'Contract exchanged',
      completedByEvents: ['contract_exchanged'],
    },
    {
      id: 'funds',
      label: 'Funds in place for completion',
      completedByEvents: ['payment_recorded'],
    },
    {
      id: 'completion',
      label: 'Completion recorded on-chain',
      completedByEvents: ['blockchain_completed'],
    },
  ],
  completed: [
    {
      id: 'completion-on-chain',
      label: 'Completion recorded on-chain',
      completedByEvents: ['blockchain_completed'],
    },
    {
      id: 'land-registry',
      label: 'Land Registry submission',
      completedByEvents: ['lr_submission'],
    },
    {
      id: 'land-registry-registered',
      label: 'Title registered',
      completedByEvents: ['lr_submission'], // final state — no separate event today
    },
  ],
};

// ============================================
// Derivation
// ============================================

interface AuditEventLike {
  eventType: string;
  timestamp: number;
}

export function getChecklistForPhase(phase: Phase): ChecklistItem[] {
  return DEFINITIONS[phase] ?? [];
}

/**
 * Produce the live checklist state for the current phase by matching each
 * item's completion triggers against the transaction's audit event stream.
 * An item is completed if ANY of its completedByEvents appears in the stream.
 */
export function deriveChecklistState(
  phase: Phase,
  events: AuditEventLike[],
): PhaseChecklistState {
  const items = getChecklistForPhase(phase);
  const itemStates: ChecklistItemState[] = items.map((item) => {
    let earliest: number | null = null;
    for (const e of events) {
      if (item.completedByEvents.includes(e.eventType)) {
        if (earliest === null || e.timestamp < earliest) earliest = e.timestamp;
      }
    }
    return { ...item, completed: earliest !== null, completedAt: earliest };
  });
  const completedCount = itemStates.filter((i) => i.completed).length;
  const progress = itemStates.length > 0 ? completedCount / itemStates.length : 0;
  return { phase, items: itemStates, progress };
}
