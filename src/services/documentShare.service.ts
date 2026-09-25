// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * documentShare.service — per-doc, per-party consent sharing of Wallet docs
 * within a transaction (share-wallet-docs Phase 3, map #123).
 *
 * Share = promote-once server-side copy of the wallet object into the
 * grant-gated shared/ prefix + a
 * document_share_grants row + an on-chain recordDocShared consent event,
 * all-or-nothing. Revoke = grant flip + object removal when last grant goes;
 * the on-chain revoke log is best-effort (revocation must never be blocked).
 */
import { supabase } from '../lib/supabase';
import { icpService } from './icp.service';
import { logger } from '@/utils/logger';
import { EXT_BY_MIME, WALLET_BUCKET, type VaultDocument } from '../types/vault.types';

type AuditResult = { ok: null } | { err: string };

interface ShareActor {
  recordDocShared: (txId: string, docHash: string, party: string) => Promise<AuditResult>;
  recordDocShareRevoked: (txId: string, docHash: string, party: string) => Promise<AuditResult>;
}

export interface ShareGrant {
  id: string;
  transactionId: string;
  docHash: string;
  slotId: string | null;
  objectPath: string;
  granteePrincipal: string;
  status: 'active' | 'revoked';
  createdAt: string;
  revokedAt: string | null;
  /** Set at deal completion: access ends here (completed + 14 days, decision 8). */
  expiresAt: string | null;
}

/** Days a completed deal's shares stay readable before they are erased (spec decision 8). */
export const COMPLETION_GRACE_DAYS = 14;

export interface RevokeResult {
  auditLogged: boolean;
}

interface GrantRow {
  id: string;
  transaction_id: string;
  doc_hash: string;
  slot_id: string | null;
  object_path: string;
  grantee_principal: string;
  status: 'active' | 'revoked';
  created_at: string;
  revoked_at: string | null;
  expires_at?: string | null;
}

function mapRow(row: GrantRow): ShareGrant {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    docHash: row.doc_hash,
    slotId: row.slot_id,
    objectPath: row.object_path,
    granteePrincipal: row.grantee_principal,
    status: row.status,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
    expiresAt: row.expires_at ?? null,
  };
}

class DocumentShareService {
  async listMyGrants(transactionId: string): Promise<ShareGrant[]> {
    const { data, error } = await supabase
      .from('document_share_grants')
      .select('*')
      .eq('transaction_id', transactionId)
      .eq('status', 'active');
    if (error) throw new Error(`Failed to load share grants: ${error.message}`);
    return ((data ?? []) as GrantRow[]).map(mapRow);
  }

  /** Active grants for one document (by hash), across all deals or within one. */
  async listGrantsForDoc(docHash: string, transactionId?: string): Promise<ShareGrant[]> {
    let query = supabase
      .from('document_share_grants')
      .select('*')
      .eq('doc_hash', docHash)
      .eq('status', 'active');
    if (transactionId) query = query.eq('transaction_id', transactionId);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to load share grants: ${error.message}`);
    return ((data ?? []) as GrantRow[]).map(mapRow);
  }

  /** Every grant (active + revoked) the user has made in a deal, oldest first — feeds the doc history line. */
  async listGrantHistory(transactionId: string): Promise<ShareGrant[]> {
    const { data, error } = await supabase
      .from('document_share_grants')
      .select('*')
      .eq('transaction_id', transactionId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Failed to load share history: ${error.message}`);
    return ((data ?? []) as GrantRow[]).map(mapRow);
  }

  /**
   * Deal completed: give every active grant in it an expiry of
   * completedAt + 14 days (only where none is set yet). RLS denies reads past
   * expires_at; erasure follows via expireOverdue. Returns the expiry used.
   */
  async scheduleExpiryForDeal(transactionId: string, completedAt: Date = new Date()): Promise<string> {
    const expiresAt = new Date(completedAt.getTime() + COMPLETION_GRACE_DAYS * 86_400_000).toISOString();
    const { error } = await supabase
      .from('document_share_grants')
      .update({ expires_at: expiresAt })
      .eq('transaction_id', transactionId)
      .eq('status', 'active')
      .is('expires_at', null);
    if (error) throw new Error(`Failed to schedule share expiry: ${error.message}`);
    return expiresAt;
  }

  /** Revoke (erase + on-chain log) every grant in a deal whose expiry has passed. */
  async expireOverdue(transactionId: string): Promise<number> {
    const { data, error } = await supabase
      .from('document_share_grants')
      .select('*')
      .eq('transaction_id', transactionId)
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString());
    if (error) throw new Error(`Failed to check expired shares: ${error.message}`);
    const overdue = ((data ?? []) as GrantRow[]).map(mapRow);
    let revoked = 0;
    for (const grant of overdue) {
      try {
        await this.revokeShare(grant);
        revoked += 1;
      } catch (err) {
        logger.error('[documentShare] expiry revoke failed', grant.id, err);
      }
    }
    return revoked;
  }

  async shareDocument(
    doc: VaultDocument,
    transactionId: string,
    granteePrincipal: string
  ): Promise<ShareGrant> {
    const userId = await this.requireUserId();
    const actor = this.requireShareActor();
    const objectPath = await this.ensureSharedObject(doc, transactionId, userId);

    const { data, error } = await supabase
      .from('document_share_grants')
      .insert({
        transaction_id: transactionId,
        doc_hash: doc.fileHash,
        blockchain_id: doc.blockchainId === undefined ? null : Number(doc.blockchainId),
        slot_id: doc.slotId,
        object_path: objectPath,
        grantee_principal: granteePrincipal,
        granted_by_user_id: userId,
        status: 'active',
      })
      .select()
      .single();
    if (error) throw new Error(`Failed to record the share grant: ${error.message}`);
    const grant = mapRow(data as GrantRow);

    try {
      const result = await actor.recordDocShared(transactionId, doc.fileHash, granteePrincipal);
      if ('err' in result) throw new Error(result.err);
    } catch (err) {
      logger.error('[documentShare] on-chain consent log failed — rolling back', err);
      await this.rollbackGrant(grant);
      throw new Error('The on-chain consent record failed, so the share was rolled back. Try again.');
    }
    return grant;
  }

  async revokeShare(grant: ShareGrant): Promise<RevokeResult> {
    const { error } = await supabase
      .from('document_share_grants')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('id', grant.id);
    if (error) throw new Error(`Failed to revoke the share: ${error.message}`);
    await this.removeObjectIfUnreferenced(grant.objectPath);

    try {
      const actor = this.requireShareActor();
      const result = await actor.recordDocShareRevoked(
        grant.transactionId,
        grant.docHash,
        grant.granteePrincipal
      );
      if ('err' in result) throw new Error(result.err);
      return { auditLogged: true };
    } catch (err) {
      logger.error('[documentShare] on-chain revoke log failed (revoke stands)', err);
      return { auditLogged: false };
    }
  }

  private async requireUserId(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) throw new Error('Please sign in again to share documents.');
    return userId;
  }

  private requireShareActor(): ShareActor {
    const actor = icpService.transactionManager as ShareActor | null;
    if (!actor || typeof actor.recordDocShared !== 'function') {
      throw new Error('On-chain consent logging is unavailable right now — nothing was shared.');
    }
    return actor;
  }

  private async ensureSharedObject(
    doc: VaultDocument,
    transactionId: string,
    userId: string
  ): Promise<string> {
    const { data, error } = await supabase
      .from('document_share_grants')
      .select('object_path')
      .eq('transaction_id', transactionId)
      .eq('doc_hash', doc.fileHash)
      .eq('status', 'active')
      .limit(1);
    if (error) throw new Error(`Failed to check existing shares: ${error.message}`);
    const existing = (data ?? []) as Array<{ object_path: string }>;
    if (existing.length > 0) return existing[0].object_path;

    const ext = EXT_BY_MIME[doc.mimeType] ?? '';
    const objectPath = `shared/${transactionId}/${userId}/${doc.slotId}-${doc.fileHash.slice(0, 12)}${ext}`;
    // Server-side copy: the wallet object is owner-readable and the shared/ path
    // is owner-writable (3rd segment = auth.uid), so no bytes round-trip the browser.
    const { error: cpErr } = await supabase.storage
      .from(WALLET_BUCKET)
      .copy(doc.objectPath, objectPath);
    if (cpErr && !/already exists|duplicate/i.test(cpErr.message)) {
      logger.error('[documentShare] wallet→shared copy failed', cpErr);
      throw new Error('This document is no longer in your wallet — re-upload it and try again.');
    }
    return objectPath;
  }

  private async removeObjectIfUnreferenced(objectPath: string): Promise<void> {
    const { data, error } = await supabase
      .from('document_share_grants')
      .select('id')
      .eq('object_path', objectPath)
      .eq('status', 'active')
      .limit(1);
    if (error) {
      logger.error('[documentShare] could not check remaining grants', error);
      return;
    }
    if (((data ?? []) as Array<{ id: string }>).length > 0) return;
    const { error: rmErr } = await supabase.storage.from(WALLET_BUCKET).remove([objectPath]);
    if (rmErr) logger.error('[documentShare] failed to remove shared object', rmErr);
  }

  private async rollbackGrant(grant: ShareGrant): Promise<void> {
    const { error } = await supabase.from('document_share_grants').delete().eq('id', grant.id);
    if (error) {
      logger.error('[documentShare] rollback delete failed', error);
      return;
    }
    await this.removeObjectIfUnreferenced(grant.objectPath);
  }
}

export const documentShareService = new DocumentShareService();
