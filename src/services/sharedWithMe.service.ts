// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * sharedWithMe.service — the receiving end of wallet document sharing for a
 * buyer, seller or estate agent (Marc, 2026-11-09). Mirrors the conveyancer
 * portal's SharedWithYouSection: the list comes from get_my_shared_docs
 * (grants to any of my principals, active and unexpired), and the bytes from
 * plain storage, gated server-side by can_read_shared_object. Nothing here
 * can widen access: both checks live in the database.
 */
import { supabase } from '../lib/supabase';
import { CUSTOM_SLOT_ONCHAIN_LABEL, VAULT_SLOTS, WALLET_BUCKET } from '../types/vault.types';

export interface SharedWithMeDoc {
  transactionId: string;
  docHash: string;
  slotId: string | null;
  objectPath: string;
  sharedAt: string;
  expiresAt: string | null;
}

interface SharedDocRow {
  transaction_id: string;
  doc_hash: string;
  slot_id: string | null;
  object_path: string;
  created_at: string;
  expires_at?: string | null;
}

export async function listSharedWithMe(transactionId: string): Promise<SharedWithMeDoc[]> {
  const { data, error } = await supabase.rpc('get_my_shared_docs', { p_transaction_id: transactionId });
  if (error) throw new Error(`Failed to load shared documents: ${error.message}`);
  return ((data ?? []) as SharedDocRow[]).map((r) => ({
    transactionId: r.transaction_id,
    docHash: r.doc_hash,
    slotId: r.slot_id,
    objectPath: r.object_path,
    sharedAt: r.created_at,
    expiresAt: r.expires_at ?? null,
  }));
}

export async function downloadSharedDoc(objectPath: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(WALLET_BUCKET).download(objectPath);
  if (error || !data) {
    throw new Error('That document is no longer available — the share may have been revoked.');
  }
  return data;
}

/**
 * The generic slot label. A custom slot's own name lives on the owner's
 * device only (ADR 0003), so the recipient sees the generic label.
 */
export function sharedDocLabel(slotId: string | null): string {
  const slot = VAULT_SLOTS.find((s) => s.id === slotId);
  if (!slot) return 'Document';
  return slot.custom ? CUSTOM_SLOT_ONCHAIN_LABEL : slot.label;
}
