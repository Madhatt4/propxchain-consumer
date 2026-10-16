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
  /** On an in-date fact: the certificate's last valid day, `YYYY-MM-DD`, when it could be read. */
  validUntil?: string | null;
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

/** What each dated certificate is called when its last valid day is known. */
const DATED_NAMES: Readonly<Record<string, string>> = {
  'gas_safety.in_date': 'Gas safety record',
  'eicr.in_date': 'Electrical report',
  'epc.in_date': 'EPC',
};

const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** `YYYY-MM-DD` as "30 Oct 2026". */
export function formatDay(isoDay: string): string {
  return DAY.format(new Date(`${isoDay.slice(0, 10)}T00:00:00Z`));
}

/** Today's UTC calendar day as `YYYY-MM-DD`, the shape valid_until is compared in. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** True once the last valid day has passed: a certificate is valid for the whole of that day. */
export function hasLapsed(validUntil: string, now: Date = new Date()): boolean {
  return validUntil.slice(0, 10) < todayIso(now);
}

/**
 * The fact in the seller's words. An in-date fact with a known last valid
 * day is read afresh against today, so a confirmed certificate that has
 * since run out says so (decision Q25, 2026-10-16). Without a day, a photo's
 * in-date is Jev's judgement on the day it was checked (decision Q19).
 */
export function factLabel(
  fact: Pick<DocFact, 'factKey' | 'value' | 'method' | 'validUntil'>,
  now: Date = new Date(),
): string {
  if (fact.factKey === 'epc.band') return `EPC rating ${fact.value}`;
  const dated = DATED_NAMES[fact.factKey];
  if (dated && fact.validUntil) {
    return hasLapsed(fact.validUntil, now)
      ? `${dated} ran out on ${formatDay(fact.validUntil)}`
      : `${dated} is in date until ${formatDay(fact.validUntil)}`;
  }
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

/** One fact as document_facts_current() returns it: the newest confirmed, else the newest suggestion. */
export interface CurrentFact {
  factKey: string;
  value: string;
  method: DocFactMethod;
  status: 'suggested' | 'confirmed';
  /** The bucket-relative path of the file the fact was read from. */
  storagePath: string;
  checkedAt: string;
  decidedAt: string | null;
  /** On an in-date fact: the certificate's last valid day, when it could be read. */
  validUntil: string | null;
}

interface CurrentFactRow {
  fact_key: string;
  value: string;
  method: DocFactMethod;
  status: 'suggested' | 'confirmed';
  storage_path: string;
  checked_at: string;
  decided_at: string | null;
  valid_until?: string | null;
}

/**
 * What counts for each fact on this transaction, as the reader is allowed to
 * see it (the table's party-read policy applies). Empty on any failure: the
 * facts are an enhancement, never an error the page should show.
 */
export async function loadCurrentFacts(transactionId: string): Promise<CurrentFact[]> {
  let rows: CurrentFactRow[];
  try {
    const { data, error } = await supabase.rpc('document_facts_current', { p_transaction_id: transactionId });
    if (error || !Array.isArray(data)) {
      if (error) logger.warn('Document facts unavailable:', error);
      return [];
    }
    rows = data as CurrentFactRow[];
  } catch (err) {
    logger.warn('Document facts request failed:', err);
    return [];
  }
  return rows.map((r) => ({
    factKey: r.fact_key,
    value: r.value,
    method: r.method,
    status: r.status,
    storagePath: r.storage_path,
    checkedAt: r.checked_at,
    decidedAt: r.decided_at,
    validUntil: r.valid_until ?? null,
  }));
}
