// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Search sign-off for one deal. The buyer and/or the buyer's conveyancer
 * each sign off the searches whose results are back. The record lives in
 * Supabase (search_signoffs); its SHA-256 goes on the deal's ledger, so the
 * chain proves what was signed and when, with no names on it.
 *
 * Every rule is enforced server-side (migration 20260927_search_signoffs):
 * the server works out the signer's role, picks the orders and computes the
 * hash. The client only asks.
 */

import { supabase } from '@/lib/supabase';
import { icpService } from '@/services/icp.service';
import { logger } from '@/utils/logger';

export type SignOffRole = 'buyer' | 'conveyancer';

export interface DealSearchOrder {
  searchOrderId: string;
  provider: string;
  orderedAt: string;
  hasResults: boolean;
}

export interface SearchSignOffRecord {
  id: string;
  signerUserId: string;
  signerRole: SignOffRole;
  searchOrderIds: string[];
  notes: string | null;
  signedAt: string;
  recordHash: string;
  revokedAt: string | null;
  revokeReason: string | null;
}

interface SignOffRow {
  id: string;
  signer_user_id: string;
  signer_role: SignOffRole;
  search_order_ids: string[];
  notes: string | null;
  signed_at: string;
  record_hash: string;
  revoked_at: string | null;
  revoke_reason: string | null;
}

function toRecord(row: SignOffRow): SearchSignOffRecord {
  return {
    id: row.id,
    signerUserId: row.signer_user_id,
    signerRole: row.signer_role,
    searchOrderIds: row.search_order_ids,
    notes: row.notes,
    signedAt: row.signed_at,
    recordHash: row.record_hash,
    revokedAt: row.revoked_at,
    revokeReason: row.revoke_reason,
  };
}

function logToLedger(transactionId: string, eventType: string, details: string, payload: object): void {
  void icpService.ledgerManager
    ?.logEvent(transactionId, eventType, details, [JSON.stringify(payload)])
    .catch((err: unknown) => logger.warn('[searchSignOff] logEvent failed', { eventType, err }));
}

/** The caller's role for signing off on this deal, or null if they can't. */
export async function getMySignOffRole(transactionId: string): Promise<SignOffRole | null> {
  const { data, error } = await supabase.rpc('my_search_signoff_role', { p_transaction_id: transactionId });
  if (error) throw new Error(`Could not check your role: ${error.message}`);
  return (data as SignOffRole | null) ?? null;
}

export async function getDealSearchOrders(transactionId: string): Promise<DealSearchOrder[]> {
  const { data, error } = await supabase.rpc('transaction_search_status', { p_transaction_id: transactionId });
  if (error) throw new Error(`Could not load searches: ${error.message}`);
  return ((data ?? []) as Array<{ search_order_id: string; provider: string; ordered_at: string; has_results: boolean }>).map(
    (r) => ({ searchOrderId: r.search_order_id, provider: r.provider, orderedAt: r.ordered_at, hasResults: r.has_results }),
  );
}

/** Every sign-off on the deal, live and revoked, newest first. */
export async function getSignOffs(transactionId: string): Promise<SearchSignOffRecord[]> {
  const { data, error } = await supabase
    .from('search_signoffs')
    .select('id, signer_user_id, signer_role, search_order_ids, notes, signed_at, record_hash, revoked_at, revoke_reason')
    .eq('transaction_id', transactionId)
    .order('signed_at', { ascending: false });
  if (error) throw new Error(`Could not load sign-offs: ${error.message}`);
  return ((data ?? []) as SignOffRow[]).map(toRecord);
}

export async function signOffSearches(transactionId: string, notes: string): Promise<void> {
  const { data, error } = await supabase.rpc('sign_off_searches', {
    p_transaction_id: transactionId,
    p_notes: notes,
  });
  if (error) throw new Error(error.message);
  const row = (data as Array<{ id: string; signer_role: SignOffRole; search_order_ids: string[]; record_hash: string }>)[0];
  logToLedger(transactionId, 'searches_signed_off', 'Search results signed off', {
    signOffId: row.id,
    signerRole: row.signer_role,
    searchCount: row.search_order_ids.length,
    recordHash: row.record_hash,
  });
}

export async function revokeSignOff(transactionId: string, signOffId: string, reason: string): Promise<void> {
  const { data, error } = await supabase.rpc('revoke_search_signoff', {
    p_signoff_id: signOffId,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
  logToLedger(transactionId, 'searches_signoff_revoked', 'Search sign-off revoked', {
    signOffId,
    revokeHash: data as string,
  });
}
