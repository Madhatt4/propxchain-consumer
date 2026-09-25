// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * transactionWallet.service — the explicit "send" step between the PropXchain
 * Wallet and a deal's Transaction Wallet (wallet spec 2026-08-18, decisions 1,
 * 10, 11). A sent item is a reference (transaction_wallet_items → wallet
 * document); it is private until a party is switched on. Removing a file from
 * the wallet cascades: revoke every grant, then delete the row (items cascade
 * in the database).
 */
import { supabase } from '../lib/supabase';
import { documentShareService } from './documentShare.service';
import { vaultDocumentService } from './vaultDocument.service';
import { mapWalletRow, type WalletRow } from './walletRows';
import type { VaultDocument } from '../types/vault.types';
import { logger } from '@/utils/logger';

export interface SentItem {
  itemId: string;
  sentAt: string;
  doc: VaultDocument;
}

interface ItemRow {
  id: string;
  sent_at: string;
  wallet_documents: WalletRow;
}

const isDuplicate = (message: string): boolean => /duplicate|unique/i.test(message);

class TransactionWalletService {
  /** Wallet documents sent to this deal, newest sent first. */
  async listSent(transactionId: string): Promise<SentItem[]> {
    const { data, error } = await supabase
      .from('transaction_wallet_items')
      .select('id, sent_at, wallet_documents(*)')
      .eq('transaction_id', transactionId)
      .order('sent_at', { ascending: false });
    if (error) throw new Error(`Failed to load this deal's wallet: ${error.message}`);
    return ((data ?? []) as unknown as ItemRow[])
      .filter((r) => r.wallet_documents)
      .map((r) => ({ itemId: r.id, sentAt: r.sent_at, doc: mapWalletRow(r.wallet_documents) }));
  }

  /** Put a wallet document into a deal. Idempotent — a repeat send returns the existing item. */
  async send(transactionId: string, doc: VaultDocument): Promise<SentItem> {
    const userId = await this.requireUserId();
    const { data, error } = await supabase
      .from('transaction_wallet_items')
      .insert({ transaction_id: transactionId, user_id: userId, wallet_document_id: doc.id })
      .select('id, sent_at')
      .single();
    if (error) {
      if (!isDuplicate(error.message)) throw new Error(`Could not send to this deal: ${error.message}`);
      return this.findItem(transactionId, doc);
    }
    const row = data as { id: string; sent_at: string };
    return { itemId: row.id, sentAt: row.sent_at, doc };
  }

  /** Take a document out of a deal: revoke its grants in that deal, then drop the item. */
  async unsend(transactionId: string, doc: VaultDocument): Promise<{ revoked: number }> {
    const revoked = await this.revokeAll(await documentShareService.listGrantsForDoc(doc.fileHash, transactionId));
    const { error } = await supabase
      .from('transaction_wallet_items')
      .delete()
      .eq('transaction_id', transactionId)
      .eq('wallet_document_id', doc.id);
    if (error) throw new Error(`Could not remove from this deal: ${error.message}`);
    return { revoked };
  }

  /** Transaction ids a wallet document has been sent to (for the cascade confirm). */
  async listDealsFor(doc: VaultDocument): Promise<string[]> {
    const { data, error } = await supabase
      .from('transaction_wallet_items')
      .select('transaction_id')
      .eq('wallet_document_id', doc.id);
    if (error) throw new Error(`Could not check deals: ${error.message}`);
    return ((data ?? []) as Array<{ transaction_id: string }>).map((r) => r.transaction_id);
  }

  /**
   * Cascade delete (decision 10): revoke every active grant for this file in
   * every deal, then remove the wallet row (items cascade). A failed revoke is
   * logged and does not block the removal — the user asked for it gone.
   */
  async removeFromWalletEverywhere(doc: VaultDocument): Promise<{ revoked: number }> {
    const revoked = await this.revokeAll(await documentShareService.listGrantsForDoc(doc.fileHash));
    await vaultDocumentService.removeDocument(doc);
    return { revoked };
  }

  private async revokeAll(
    grants: Awaited<ReturnType<typeof documentShareService.listGrantsForDoc>>,
  ): Promise<number> {
    let revoked = 0;
    for (const grant of grants) {
      try {
        await documentShareService.revokeShare(grant);
        revoked += 1;
      } catch (err) {
        logger.error('[transactionWallet] revoke failed during cascade', grant.id, err);
      }
    }
    return revoked;
  }

  private async findItem(transactionId: string, doc: VaultDocument): Promise<SentItem> {
    const { data, error } = await supabase
      .from('transaction_wallet_items')
      .select('id, sent_at')
      .eq('transaction_id', transactionId)
      .eq('wallet_document_id', doc.id)
      .single();
    if (error || !data) throw new Error('Could not confirm the send. Refresh and try again.');
    const row = data as { id: string; sent_at: string };
    return { itemId: row.id, sentAt: row.sent_at, doc };
  }

  private async requireUserId(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) throw new Error('Please sign in again to use your wallet.');
    return userId;
  }
}

export const transactionWalletService = new TransactionWalletService();
