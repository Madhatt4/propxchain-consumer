// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * walletProof.service — proof-only QR links for a deal's Transaction Wallet
 * (wallet spec 2026-08-18, decisions 4, 12, 13). A link snapshots the anchor
 * FACTS of the chosen sent documents — slot label, hash prefix, on-chain proof
 * id, anchored + verified timestamps — checked against document_storage when
 * the link is generated. Never a filename, name, address, or file. 24 h expiry
 * by default, revocable, max 5 active per deal. Anonymous viewers read via the
 * wallet-proof-view edge function (which counts views).
 */
import { supabase } from '../lib/supabase';
import { icpService } from './icp.service';
import { VAULT_SLOTS, type VaultDocument } from '../types/vault.types';

export const PROOF_TTL_HOURS = 24;
export const MAX_ACTIVE_PROOFS_PER_DEAL = 5;

export interface ProofItem {
  slotLabel: string;
  hashPrefix: string;
  blockchainId: number;
  /** ISO — when the hash was anchored on-chain (from document_storage). */
  anchoredAt: string | null;
  /** ISO — when we re-checked the anchor while generating this link; null if it failed. */
  verifiedAt: string | null;
}

export interface ProofLink {
  id: string;
  transactionId: string;
  token: string;
  items: ProofItem[];
  status: 'active' | 'revoked';
  expiresAt: string;
  viewCount: number;
  lastViewedAt: string | null;
  createdAt: string;
}

export interface PublicProof {
  items: ProofItem[];
  expiresAt: string;
  generatedAt: string;
}

interface ProofRow {
  id: string;
  transaction_id: string;
  token: string;
  items: ProofItem[];
  status: 'active' | 'revoked';
  expires_at: string;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
}

const SELECT = 'id, transaction_id, token, items, status, expires_at, view_count, last_viewed_at, created_at';

function mapRow(r: ProofRow): ProofLink {
  return {
    id: r.id,
    transactionId: r.transaction_id,
    token: r.token,
    items: r.items,
    status: r.status,
    expiresAt: r.expires_at,
    viewCount: Number(r.view_count),
    lastViewedAt: r.last_viewed_at,
    createdAt: r.created_at,
  };
}

function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Slot label only — a custom slot's user name never leaves the device (ADR 0003). */
function genericSlotLabel(doc: VaultDocument): string {
  return VAULT_SLOTS.find((s) => s.id === doc.slotId)?.onChainLabel ?? 'Document';
}

/** Re-check one doc's anchor on-chain and snapshot the facts. */
export async function buildProofItem(doc: VaultDocument): Promise<ProofItem> {
  const base: ProofItem = {
    slotLabel: genericSlotLabel(doc),
    hashPrefix: doc.fileHash.slice(0, 12),
    blockchainId: doc.blockchainId,
    anchoredAt: null,
    verifiedAt: null,
  };
  try {
    const proof = await icpService.getDocumentProof(doc.blockchainId);
    if (!proof || proof.fileHash.toLowerCase() !== doc.fileHash.toLowerCase()) return base;
    return {
      ...base,
      anchoredAt: proof.uploadedAt ? new Date(Math.floor(proof.uploadedAt / 1_000_000)).toISOString() : null,
      verifiedAt: new Date().toISOString(),
    };
  } catch {
    return base;
  }
}

class WalletProofService {
  async listActive(transactionId: string): Promise<ProofLink[]> {
    const { data, error } = await supabase
      .from('wallet_proof_links')
      .select(SELECT)
      .eq('transaction_id', transactionId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to load proof links: ${error.message}`);
    return ((data ?? []) as ProofRow[]).map(mapRow);
  }

  /** Every link (for the history line): active, expired and revoked. */
  async listAll(transactionId: string): Promise<ProofLink[]> {
    const { data, error } = await supabase
      .from('wallet_proof_links')
      .select(SELECT)
      .eq('transaction_id', transactionId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Failed to load proof history: ${error.message}`);
    return ((data ?? []) as ProofRow[]).map(mapRow);
  }

  async create(transactionId: string, docs: VaultDocument[]): Promise<ProofLink> {
    if (docs.length === 0) throw new Error('Pick at least one document to include.');
    const userId = await this.requireUserId();
    const active = await this.listActive(transactionId);
    if (active.length >= MAX_ACTIVE_PROOFS_PER_DEAL) {
      throw new Error(`You already have ${MAX_ACTIVE_PROOFS_PER_DEAL} active proofs for this deal — revoke one first.`);
    }
    const items = await Promise.all(docs.map(buildProofItem));
    const expiresAt = new Date(Date.now() + PROOF_TTL_HOURS * 3600_000).toISOString();
    const { data, error } = await supabase
      .from('wallet_proof_links')
      .insert({ transaction_id: transactionId, user_id: userId, token: newToken(), items, expires_at: expiresAt })
      .select(SELECT)
      .single();
    if (error) throw new Error(`Could not create the proof: ${error.message}`);
    return mapRow(data as ProofRow);
  }

  async revoke(link: ProofLink): Promise<void> {
    const { error } = await supabase
      .from('wallet_proof_links')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('id', link.id);
    if (error) throw new Error(`Could not revoke the proof: ${error.message}`);
  }

  proofUrlFor(token: string): string {
    return `${window.location.origin}/proof/${token}`;
  }

  /** Anonymous viewer fetch via the wallet-proof-view edge function; null = unknown/expired/revoked. */
  async fetchPublic(token: string): Promise<PublicProof | null> {
    const { data, error } = await supabase.functions.invoke('wallet-proof-view', { body: { token } });
    if (error) return null;
    const payload = data as Partial<PublicProof> | null;
    if (!payload?.items) return null;
    return { items: payload.items, expiresAt: payload.expiresAt ?? '', generatedAt: payload.generatedAt ?? '' };
  }

  private async requireUserId(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) throw new Error('Please sign in again.');
    return userId;
  }
}

export const walletProofService = new WalletProofService();
