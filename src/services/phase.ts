// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Pure derivation of a v3 transaction phase — frontend port of the original
 * src/transaction_manager/phase.mo module. Runs entirely client-side.
 *
 * Phase is a DISPLAY field only. It does not gate which UI panels render and
 * there is no auto-advance. See the v3 phase-model design (monorepo).
 *
 * Inputs are sourced from (a) the Transaction record for status + principals
 * and (b) the ledger_manager audit event stream for milestone timestamps.
 * The canister-side equivalents (getCurrentPhase, markSearchesOrdered,
 * markContractDrafted, getPhaseMilestones, phaseMilestones side-table)
 * became dead code as of Ship 2d and are kept only because EOP refuses to
 * drop the stable var without an explicit migration block.
 */

// Phase identifiers preserved verbatim for backward compatibility with
// anything that persisted a phase slug. Labels are the six regulatory gates
// from Propxchain/Compliance/legal-activity-map.md §"The six-stage transaction flow".
export type Phase =
  | 'sellerPrep'
  | 'buyerSetup'
  | 'searches'
  | 'preContract'
  | 'preCompletion'
  | 'completed';

export const PHASE_ORDER: Phase[] = [
  'sellerPrep',
  'buyerSetup',
  'searches',
  'preContract',
  'preCompletion',
  'completed',
];

export const PHASE_LABELS: Record<Phase, string> = {
  sellerPrep: 'Listing',
  buyerSetup: 'Offer accepted',
  searches: 'Enquiries',
  preContract: 'Exchange',
  preCompletion: 'Completion',
  completed: 'Post-completion',
};

export interface PhaseMilestones {
  searchesOrderedAt: number | null;
  contractDraftedAt: number | null;
}

export interface PhaseInput {
  /** True when the transaction's TransactionStatus is blockchain_completed or land_registry_registered. */
  isCompleted: boolean;
  /** True when the transaction's TransactionStatus is exchanged or completion_initiated. */
  isExchanged: boolean;
  /** Buyer principal, as Text. Equal to seller when no real buyer has joined yet. */
  buyer: string;
  seller: string;
  milestones: PhaseMilestones;
}

export function emptyMilestones(): PhaseMilestones {
  return { searchesOrderedAt: null, contractDraftedAt: null };
}

/**
 * Derive the current phase from a snapshot. Rules are evaluated top-to-bottom
 * and the first match wins. Mirrors src/transaction_manager/phase.mo exactly.
 */
export function derivePhase(input: PhaseInput): Phase {
  if (input.isCompleted) return 'completed';
  if (input.isExchanged) return 'preCompletion';

  // "Real buyer joined" = buyer principal distinct from seller principal.
  // createTransaction sets buyer = seller until assignBuyer runs, so this is
  // the canonical "has the buyer joined yet" signal.
  const buyerJoined = input.buyer !== input.seller;

  if (input.milestones.contractDraftedAt !== null && buyerJoined) return 'preContract';
  if (input.milestones.searchesOrderedAt !== null && buyerJoined) return 'searches';
  if (buyerJoined) return 'buyerSetup';

  return 'sellerPrep';
}

// ============================================
// Milestone extraction from audit events
// ============================================

interface AuditEventLike {
  eventType: string;
  timestamp: number;
}

/**
 * Extract phase milestones from an audit event stream.
 *
 * - `searchesOrderedAt` ← earliest `searches_ordered` event timestamp
 * - `contractDraftedAt` ← earliest `party_signature` event timestamp
 *   (using party_signature as a proxy — a party can't sign a contract that
 *   hasn't been drafted). If a dedicated `contract_drafted` event is later
 *   introduced in the audit stream, prefer that one.
 */
export function extractMilestonesFromEvents(events: AuditEventLike[]): PhaseMilestones {
  let searchesOrderedAt: number | null = null;
  let contractDraftedAt: number | null = null;

  for (const event of events) {
    if (event.eventType === 'searches_ordered') {
      if (searchesOrderedAt === null || event.timestamp < searchesOrderedAt) {
        searchesOrderedAt = event.timestamp;
      }
    } else if (event.eventType === 'contract_drafted' || event.eventType === 'party_signature') {
      // Prefer a future `contract_drafted` event, fall back to `party_signature`
      if (contractDraftedAt === null || event.timestamp < contractDraftedAt) {
        contractDraftedAt = event.timestamp;
      }
    }
  }

  return { searchesOrderedAt, contractDraftedAt };
}

// ============================================
// Status → boolean flag helpers
// ============================================

type TransactionStatusLike =
  | { active: null }
  | { exchanged: null }
  | { completion_initiated: null }
  | { blockchain_completed: null }
  | { land_registry_registered: null };

export function statusIsCompleted(status: TransactionStatusLike | null | undefined): boolean {
  if (!status) return false;
  return 'blockchain_completed' in status || 'land_registry_registered' in status;
}

export function statusIsExchanged(status: TransactionStatusLike | null | undefined): boolean {
  if (!status) return false;
  return 'exchanged' in status || 'completion_initiated' in status;
}
