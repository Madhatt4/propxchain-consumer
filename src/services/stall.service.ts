// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Stall attribution, read side (spec docs/plans/2026-09-05-stall-attribution-spec.md).
 *
 * Every stall a deal has, with the ROLE that owes the next move and how long
 * it has waited, plus the deal's stage against the benchmark. Both are
 * computed server-side by `public.deal_stall` and `public.deal_stage`
 * (caller-scoped: you must be a party), so every surface reads one answer.
 * Nothing here names a person, only roles. Free for every tier.
 */
import { supabase } from '../lib/supabase';
import type { DealSide } from './shareParty.service';

export type StallOwner =
  | 'seller'
  | 'buyer'
  | 'seller_conveyancer'
  | 'buyer_conveyancer'
  | 'estate_agent'
  | 'lender'
  | 'provider'
  | 'none';

export interface DealStall {
  /** A `stall_signals` key: an engine blocker or one of the three added signals. */
  signal: string;
  owner: StallOwner;
  since: string;
  days: number;
  /** The rules table's plain-English label for the signal. */
  label: string;
  detail: Record<string, unknown>;
}

export interface DealStage {
  stage: string;
  enteredAt: string;
  days: number;
  benchmarkDays: number;
  sampleN: number;
}

export const OWNER_LABELS: Record<StallOwner, string> = {
  seller: 'the seller',
  buyer: 'the buyer',
  seller_conveyancer: "the seller's conveyancer",
  buyer_conveyancer: "the buyer's conveyancer",
  estate_agent: 'the estate agent',
  lender: 'the lender',
  provider: 'the provider',
  none: 'nobody yet',
};

export const STAGE_LABELS: Record<string, string> = {
  instruct: 'Instructing',
  title_and_pack: 'Title and sales pack',
  searches: 'Searches',
  enquiries: 'Enquiries',
  exchange: 'Exchange',
};

const OWNER_KEYS = new Set<string>(Object.keys(OWNER_LABELS));

function asOwner(value: unknown): StallOwner {
  return typeof value === 'string' && OWNER_KEYS.has(value) ? (value as StallOwner) : 'none';
}

interface StallRow {
  signal: string;
  owner: string;
  since: string;
  days: number;
  detail: unknown;
}

interface StageRow {
  stage: string;
  entered_at: string;
  days: number;
  benchmark_days: number;
  sample_n: number;
}

/** The stalls on a deal, longest wait first. Signed out or not a party is an empty list. */
export async function loadDealStalls(transactionId: string): Promise<DealStall[]> {
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) return [];
  const { data, error } = await supabase.rpc('deal_stall', { p_transaction_id: transactionId });
  if (error) throw new Error(`Failed to read the stalls on this transaction: ${error.message}`);
  return (Array.isArray(data) ? (data as StallRow[]) : []).map((row) => {
    const detail = row.detail && typeof row.detail === 'object' ? (row.detail as Record<string, unknown>) : {};
    return {
      signal: String(row.signal),
      owner: asOwner(row.owner),
      since: String(row.since),
      days: Number(row.days),
      label: typeof detail.label === 'string' ? detail.label : String(row.signal),
      detail,
    };
  });
}

/** The deal's current stage against its benchmark; null before any history. */
export async function loadDealStage(transactionId: string): Promise<DealStage | null> {
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) return null;
  const { data, error } = await supabase.rpc('deal_stage', { p_transaction_id: transactionId });
  if (error) throw new Error(`Failed to read the stage of this transaction: ${error.message}`);
  const row = Array.isArray(data) ? (data[0] as StageRow | undefined) : undefined;
  if (!row) return null;
  return {
    stage: String(row.stage),
    enteredAt: String(row.entered_at),
    days: Number(row.days),
    benchmarkDays: Number(row.benchmark_days),
    sampleN: Number(row.sample_n),
  };
}

/** Which side of the deal an owner role sits on; null for the agent, lender, provider and 'none'. */
export function ownerSide(owner: StallOwner): DealSide | null {
  if (owner === 'seller' || owner === 'seller_conveyancer') return 'seller';
  if (owner === 'buyer' || owner === 'buyer_conveyancer') return 'buyer';
  return null;
}

export function longestWait(stalls: readonly DealStall[]): DealStall | null {
  let top: DealStall | null = null;
  for (const s of stalls) if (!top || s.days > top.days) top = s;
  return top;
}

function days(n: number): string {
  return `${n} day${n === 1 ? '' : 's'}`;
}

/** One line, roles only: "Waiting on the seller's conveyancer: enquiries waiting for an answer, 9 days". */
export function describeStall(stall: DealStall): string {
  const who = stall.owner === 'none' ? 'Waiting' : `Waiting on ${OWNER_LABELS[stall.owner]}`;
  return `${who}: ${stall.label}, ${days(stall.days)}`;
}

/** The stage against the benchmark: "Enquiries: day 12 of a usual 14" or "...: 20 days so far, past the usual 14". */
export function describeStage(stage: DealStage): string {
  const name = STAGE_LABELS[stage.stage] ?? stage.stage;
  if (stage.days > stage.benchmarkDays) {
    return `${name}: ${days(stage.days)} so far, past the usual ${stage.benchmarkDays}`;
  }
  return `${name}: day ${stage.days} of a usual ${stage.benchmarkDays}`;
}
