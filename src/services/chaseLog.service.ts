// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The agency's private chase log (spec docs/plans/2026-09-06-agent-crm-spec.md,
 * R1.3, R2.6): calls, notes and one next action per deal. Rows live under the
 * agency's row-level security and nobody on the deal reads them; each entry
 * is anchored on the ledger as a hash by the platform, so the trail proves
 * the note existed and was not altered without carrying its text.
 */
import { supabase } from '../lib/supabase';
import { logger } from '@/utils/logger';

export type ChaseKind = 'call' | 'note' | 'next_action';

export interface ChaseEntry {
  id: string;
  orgId: string;
  transactionId: string;
  listingId: string | null;
  authorUserId: string;
  kind: ChaseKind;
  body: string;
  dueAt: string | null;
  doneAt: string | null;
  createdAt: string;
  ledgerHash: string | null;
  ledgerPending: boolean;
}

interface ChaseRow {
  id: string;
  org_id: string;
  transaction_id: string;
  listing_id: string | null;
  author_user_id: string;
  kind: ChaseKind;
  body: string;
  due_at: string | null;
  done_at: string | null;
  created_at: string;
  ledger_hash: string | null;
  ledger_pending: boolean;
}

const COLUMNS = 'id, org_id, transaction_id, listing_id, author_user_id, kind, body, due_at, done_at, created_at, ledger_hash, ledger_pending';

function fromRow(r: ChaseRow): ChaseEntry {
  return {
    id: r.id, orgId: r.org_id, transactionId: r.transaction_id, listingId: r.listing_id, authorUserId: r.author_user_id,
    kind: r.kind, body: r.body, dueAt: r.due_at, doneAt: r.done_at, createdAt: r.created_at,
    ledgerHash: r.ledger_hash, ledgerPending: r.ledger_pending,
  };
}

/** Newest first. RLS scopes the read to the caller's agency. */
export async function listChaseLog(transactionId: string): Promise<ChaseEntry[]> {
  const { data, error } = await supabase
    .from('agent_chase_log')
    .select(COLUMNS)
    .eq('transaction_id', transactionId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to load the chase log: ${error.message}`);
  return ((data ?? []) as ChaseRow[]).map(fromRow);
}

/** Open next actions across the agency's desk, soonest due first. */
export async function listOpenNextActions(orgId: string): Promise<ChaseEntry[]> {
  const { data, error } = await supabase
    .from('agent_chase_log')
    .select(COLUMNS)
    .eq('org_id', orgId)
    .eq('kind', 'next_action')
    .is('done_at', null)
    .order('due_at', { ascending: true });
  if (error) throw new Error(`Failed to load next actions: ${error.message}`);
  return ((data ?? []) as ChaseRow[]).map(fromRow);
}

/** Best-effort: the platform hashes the entry and puts the hash on the ledger. Never throws. */
export async function anchorChaseEntry(noteId: string): Promise<{ ledgerPending: boolean; ledgerHash: string | null }> {
  const { data, error } = await supabase.functions.invoke<{ ledgerPending: boolean; ledgerHash: string }>('agent-delegation', {
    body: { action: 'anchor_note', noteId },
  });
  if (error || !data) {
    logger.warn('chase-log anchor failed', error);
    return { ledgerPending: true, ledgerHash: null };
  }
  return { ledgerPending: data.ledgerPending, ledgerHash: data.ledgerHash ?? null };
}

export interface AddChaseEntryInput {
  orgId: string;
  transactionId: string;
  listingId: string | null;
  kind: ChaseKind;
  body: string;
  dueAt?: string | null;
}

/** Writes the entry as the signed-in member, then anchors it. */
export async function addChaseEntry(input: AddChaseEntryInput): Promise<ChaseEntry> {
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId) throw new Error('Sign in to write to the chase log');
  const { data, error } = await supabase
    .from('agent_chase_log')
    .insert({
      org_id: input.orgId,
      transaction_id: input.transactionId,
      listing_id: input.listingId,
      author_user_id: userId,
      kind: input.kind,
      body: input.body.trim(),
      due_at: input.kind === 'next_action' ? input.dueAt ?? null : null,
    })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(`Failed to save the entry: ${error.message}`);
  const entry = fromRow(data as ChaseRow);
  const anchor = await anchorChaseEntry(entry.id);
  return { ...entry, ledgerPending: anchor.ledgerPending, ledgerHash: anchor.ledgerHash ?? entry.ledgerHash };
}

export async function markChaseDone(id: string): Promise<void> {
  const { error } = await supabase.from('agent_chase_log').update({ done_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(`Failed to mark the action done: ${error.message}`);
}
