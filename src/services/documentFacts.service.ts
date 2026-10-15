// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * documentFacts.service — the seller's side of document facts. doc-classify
 * reads a certificate (gas safety, EICR, FENSA, EPC, building regs) and
 * suggests property facts such as "in date" or "EPC band C". Nothing counts
 * until the seller confirms it (decision Q13, 2026-10-15):
 *
 *   1. confirm_document_fact() moves the row from suggested to confirmed or
 *      rejected. The database is the gate: seller side only, once only.
 *   2. A decision is then anchored on-chain with
 *      transaction_manager.recordDocumentFact (key, value, file hash), so the
 *      audit trail shows what the seller confirmed and from which file. A
 *      rejection is recorded with the value "rejected".
 *
 * Every value is a property fact. Names on a certificate are never read into
 * one, so nothing personal reaches the chain.
 */
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { icpService } from './icp.service';

export type DocFactMethod = 'code' | 'jev';

/** One suggestion as doc-classify returns it. */
export interface DocFact {
  id: string;
  factKey: string;
  value: string;
  /** Null when code read it from the document's text; Jev's certainty for a photo. */
  confidence: number | null;
  method: DocFactMethod;
}

export type FactDecision = 'confirmed' | 'rejected';

export interface FactDecisionResult {
  decision: FactDecision;
  /** False when the decision is saved but the audit-trail entry failed. */
  anchored: boolean;
}

interface DecidedRow {
  fact_key: string;
  value: string;
  source_sha256: string;
}

const REJECTED_VALUE = 'rejected';

const YES_NO_LABELS: Readonly<Record<string, readonly [yes: string, no: string]>> = {
  'gas_safety.in_date': ['Gas safety record is in date', 'Gas safety record is out of date'],
  'gas_safety.passed': ['Every gas appliance passed', 'An appliance did not pass'],
  'eicr.in_date': ['Electrical report is in date', 'Electrical report is out of date'],
  'eicr.satisfactory': ['Electrics rated satisfactory', 'Electrics rated unsatisfactory'],
  'fensa.present': ['FENSA certificate for the windows or doors', 'No FENSA certificate'],
  'epc.in_date': ['EPC is in date', 'EPC is out of date'],
  'building_regs.completion': [
    'Building regulations completion certificate',
    'Building regulations approval, not a completion certificate',
  ],
};

/**
 * The fact in the seller's words. A photo's in-date is Jev's judgement on the
 * day it was checked, so it says so (decision Q19).
 */
export function factLabel(fact: Pick<DocFact, 'factKey' | 'value' | 'method'>): string {
  if (fact.factKey === 'epc.band') return `EPC rating ${fact.value}`;
  const pair = YES_NO_LABELS[fact.factKey];
  if (!pair) return `${fact.factKey}: ${fact.value}`;
  const label = fact.value === 'true' ? pair[0] : pair[1];
  return fact.method === 'jev' && fact.factKey.endsWith('.in_date') ? `${label} (checked today)` : label;
}

function decisionError(message: string): string {
  if (message.includes('forbidden')) return 'Only the seller can confirm these.';
  if (message.includes('already_decided')) return 'This has already been answered.';
  return 'That did not save. Please try again.';
}

/**
 * Confirm or reject one suggestion. Throws with a seller-facing message when
 * the database refuses; the on-chain record failing after a saved decision is
 * reported as `anchored: false` rather than thrown, because the decision stands.
 */
export async function decideFact(
  transactionId: string,
  factId: string,
  decision: FactDecision,
): Promise<FactDecisionResult> {
  const { data, error } = await supabase.rpc('confirm_document_fact', {
    p_fact_id: factId,
    p_decision: decision,
  });
  if (error || !data) {
    logger.warn('Document fact decision failed:', error);
    throw new Error(decisionError(error?.message ?? ''));
  }
  const row = data as DecidedRow;
  try {
    await icpService.recordDocumentFact(
      transactionId,
      row.fact_key,
      decision === 'confirmed' ? row.value : REJECTED_VALUE,
      row.source_sha256,
    );
    return { decision, anchored: true };
  } catch (err) {
    logger.warn('Document fact saved but not recorded on-chain:', err);
    return { decision, anchored: false };
  }
}
