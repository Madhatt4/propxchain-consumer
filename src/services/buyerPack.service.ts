// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Buyer Pack (monorepo spec docs/plans/2026-09-05-buyer-pack-spec.md): the
 * buyer-side mirror of the Sales Pack. Status is computed server-side by
 * `buyer_pack_status` (RLS-gated to joined parties, never stored); the buyer's
 * declarations and the audit-trail sync go through the `buyer-pack` edge
 * function, which answers with the refreshed pack.
 */
import { supabase } from '../lib/supabase';

export const BUYER_PACK_ITEMS = ['id_aml', 'proof_of_funds', 'mortgage', 'chain', 'survey'] as const;
export type BuyerPackItemId = (typeof BUYER_PACK_ITEMS)[number];
export type BuyerPackStatus = 'not_started' | 'in_progress' | 'ready';
export type FundingType = 'cash' | 'mortgage';
export type ChainPosition = 'none' | 'first_time_buyer' | 'selling_linked';

/** What the other side may see. Never an amount, never a document name. */
export interface BuyerPackDetail {
  funding_type?: FundingType;
  lender_name?: string;
  mortgage_stage?: 'none' | 'dip' | 'offer';
  chain_position?: ChainPosition;
  linked_transaction_id?: string;
  survey_state?: 'none' | 'booked' | 'received';
  aml_state?: 'none' | 'pending' | 'in_progress' | 'complete' | 'failed';
}

export interface BuyerPackItem {
  item: BuyerPackItemId;
  status: BuyerPackStatus;
  detail: BuyerPackDetail;
  /** The current ready state is on the audit trail. */
  onLedger: boolean;
  /** A ledger row for this item is still waiting for the canister. */
  pending: boolean;
}

/** Absent = leave as is, null = clear. */
export interface BuyerPackDeclaration {
  fundingType?: FundingType | null;
  lenderName?: string | null;
  chainPosition?: ChainPosition | null;
  linkedTransactionId?: string | null;
  surveyReceived?: boolean;
}

/** Where the buyer uploads before sending to a deal (wallet decision 2). */
export const WALLET_PAGE_PATH = '/dashboard/my-documents';

export class BuyerPackError extends Error {
  readonly status: number;
  readonly code: string;
  readonly reason?: string;
  readonly resetIn?: number;
  constructor(status: number, code: string, reason?: string, resetIn?: number) {
    super(code);
    this.name = 'BuyerPackError';
    this.status = status;
    this.code = code;
    this.reason = reason;
    this.resetIn = resetIn;
  }
}

interface FunctionsInvokeError {
  message: string;
  context?: { status?: number; json?: () => Promise<Record<string, unknown>> };
}
async function toBuyerPackError(error: FunctionsInvokeError): Promise<BuyerPackError> {
  const status = error.context?.status ?? 0;
  try {
    const body = (await error.context?.json?.()) as { error?: string; reason?: string; resetIn?: number } | undefined;
    return new BuyerPackError(status, typeof body?.error === 'string' ? body.error : error.message, body?.reason, body?.resetIn);
  } catch {
    return new BuyerPackError(status, error.message);
  }
}
async function invoke(body: Record<string, unknown>): Promise<BuyerPackItem[]> {
  const { data, error } = await supabase.functions.invoke<{ items: BuyerPackItem[] }>('buyer-pack', { body });
  if (error) throw await toBuyerPackError(error as FunctionsInvokeError);
  return data?.items ?? [];
}

interface StatusRow { item: BuyerPackItemId; status: BuyerPackStatus; detail: BuyerPackDetail | null }
interface LedgerRow { item: BuyerPackItemId; status: 'ready' | 'withdrawn'; ledger_pending: boolean; created_at: string }

/** Join the computed status to the newest ledger row per item (rows arrive newest first). */
export function mergeWithLedger(status: StatusRow[], ledger: LedgerRow[]): BuyerPackItem[] {
  // Sort here too, so the rule does not depend on the caller's query order.
  const newestFirst = [...ledger].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
  return status.map((s) => {
    const latest = newestFirst.find((r) => r.item === s.item);
    return {
      item: s.item,
      status: s.status,
      detail: s.detail ?? {},
      onLedger: s.status === 'ready' && latest?.status === 'ready' && !latest.ledger_pending,
      pending: !!latest?.ledger_pending,
    };
  });
}

/** Everyone joined to the deal reads this; the server decides who is joined. */
export async function loadBuyerPack(transactionId: string): Promise<BuyerPackItem[]> {
  const [statusRes, ledgerRes] = await Promise.all([
    supabase.rpc('buyer_pack_status', { p_transaction_id: transactionId }),
    supabase
      .from('buyer_pack_ledger')
      .select('item, status, ledger_pending, created_at')
      .eq('transaction_id', transactionId)
      .order('created_at', { ascending: false }),
  ]);
  if (statusRes.error) throw new BuyerPackError(0, 'read_failed', `buyer_pack_status: ${statusRes.error.message}`);
  if (ledgerRes.error) throw new BuyerPackError(0, 'read_failed', `buyer_pack_ledger: ${ledgerRes.error.message}`);
  return mergeWithLedger((statusRes.data ?? []) as StatusRow[], (ledgerRes.data ?? []) as LedgerRow[]);
}

/** The buyer's own facts; the server refuses anyone else. Answers with the refreshed pack. */
export function declareBuyerPack(transactionId: string, declaration: BuyerPackDeclaration): Promise<BuyerPackItem[]> {
  return invoke({ action: 'declare', transactionId, declaration });
}

/** Make the audit trail match the pack. Any joined party may call it. */
export function syncBuyerPack(transactionId: string): Promise<BuyerPackItem[]> {
  return invoke({ action: 'sync', transactionId });
}
