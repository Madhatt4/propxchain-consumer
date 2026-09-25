// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * PropXchain Wallet document service.
 *
 * Given a user + a slot + a file: hash it, anchor the hash on-chain
 * (principal-scoped, no transaction), then keep the file in OWNER-ONLY
 * Supabase Storage under wallet/<auth.uid>/… with a wallet_documents row.
 * Anchor-first, and the object is removed if the row insert fails, so the
 * listing never claims a file we don't hold. Filenames are never stored
 * (wallet spec 2026-08-18, decision 6). Custom slot names stay on-device
 * (ADR 0003). Oscar AI never sees wallet files.
 */
import { supabase } from '../lib/supabase';
import { icpService } from './icp.service';
import { generateFileHash } from '../utils/hashGenerator';
import {
  WALLET_BUCKET,
  WALLET_LABEL_MAX,
  walletObjectPath,
  type VaultDocument,
  type VaultSlot,
  type VaultSlotId,
} from '../types/vault.types';
import { mapWalletRow, type UsageRow, type WalletRow } from './walletRows';
import { logger } from '@/utils/logger';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/** Returns an error message if the file is unacceptable, else null. */
export function validateVaultFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Please upload a PDF, JPG, or PNG file';
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'File size must be less than 10MB';
  }
  return null;
}

/** Tier-derived limits the caller passes in (see subscriptionFeatures). */
export interface VaultCaps {
  maxFilesPerSlot: number;
  maxTotalBytes: number;
}

/** A file whose hash is already anchored on-chain (legacy migration). */
export interface AnchoredFileInput {
  blob: Blob;
  slotId: VaultSlotId;
  fileHash: string;
  blockchainId: number;
  mimeType: string;
  fileSize: number;
  /** Optional owner-only label (decision 18); trimmed, blank → null. */
  label?: string | null;
}

/** Trim a user-typed label; blank → null. Never touches the on-chain path. */
export function normaliseLabel(label: string | null | undefined): string | null {
  const trimmed = (label ?? '').trim();
  return trimmed ? trimmed.slice(0, WALLET_LABEL_MAX) : null;
}

const isDuplicateObject = (message: string): boolean => /already exists|duplicate/i.test(message);

class VaultDocumentService {
  /**
   * Validate → cap check → hash → anchor on-chain → upload → row. Throws a
   * user-facing Error on any failure; nothing is stored if the anchor fails.
   */
  async storeDocument(
    file: File,
    slot: VaultSlot,
    caps: VaultCaps,
    label?: string,
  ): Promise<VaultDocument> {
    const validationError = validateVaultFile(file);
    if (validationError) throw new Error(validationError);

    const userId = await this.requireUserId();
    await this.assertWithinCaps(slot.id, file.size, caps);

    const contentType = file.type || 'application/octet-stream';
    const fileHash = await generateFileHash(file);
    const blockchainId = await this.anchorHash(file.size, fileHash, contentType, slot);
    return this.persist(userId, {
      blob: file,
      slotId: slot.id,
      fileHash,
      blockchainId,
      mimeType: contentType,
      fileSize: file.size,
      label: normaliseLabel(label),
    });
  }

  /** Change (or clear) the owner-only label on a wallet file. Returns the stored value. */
  async setLabel(doc: VaultDocument, label: string): Promise<string | null> {
    const value = normaliseLabel(label);
    const { error } = await supabase.from('wallet_documents').update({ label: value }).eq('id', doc.id);
    if (error) throw new Error(`Could not save the label: ${error.message}`);
    return value;
  }

  /** Record a file whose hash is ALREADY anchored (legacy local-wallet migration). */
  async importAnchored(input: AnchoredFileInput): Promise<VaultDocument> {
    const userId = await this.requireUserId();
    return this.persist(userId, input);
  }

  /** The signed-in user's wallet documents, newest first (RLS scopes the query). */
  async listMyDocuments(): Promise<VaultDocument[]> {
    const { data, error } = await supabase
      .from('wallet_documents')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to load your wallet: ${error.message}`);
    return ((data ?? []) as WalletRow[]).map(mapWalletRow);
  }

  async getUsageBytes(): Promise<number> {
    const rows = await this.usageRows();
    return rows.reduce((sum, r) => sum + Number(r.file_size), 0);
  }

  async getFile(doc: VaultDocument): Promise<Blob> {
    const { data, error } = await supabase.storage.from(WALLET_BUCKET).download(doc.objectPath);
    if (error || !data) throw new Error('The stored file could not be retrieved.');
    return data;
  }

  /** Delete the row and the object. The on-chain hash anchor is immutable. */
  async removeDocument(doc: VaultDocument): Promise<void> {
    const { error } = await supabase.from('wallet_documents').delete().eq('id', doc.id);
    if (error) throw new Error(`Could not remove document: ${error.message}`);
    const { error: rmErr } = await supabase.storage.from(WALLET_BUCKET).remove([doc.objectPath]);
    if (rmErr) logger.error('[wallet] object removal failed after row delete', rmErr);
  }

  /** localStorage key for a custom slot's user-chosen name (local only; never on-chain). */
  private customSlotNameKey(principal: string, slotId: VaultSlotId): string {
    return `vault:customSlotName:${principal}:${slotId}`;
  }

  /** The user's local name for a custom slot, or null if unnamed. */
  getCustomSlotName(principal: string, slotId: VaultSlotId): string | null {
    try {
      return localStorage.getItem(this.customSlotNameKey(principal, slotId));
    } catch {
      return null;
    }
  }

  /** Set (or clear, when blank) a custom slot's on-device display name (ADR 0003). */
  setCustomSlotName(principal: string, slotId: VaultSlotId, name: string): void {
    try {
      const trimmed = name.trim();
      if (trimmed) {
        localStorage.setItem(this.customSlotNameKey(principal, slotId), trimmed);
      } else {
        localStorage.removeItem(this.customSlotNameKey(principal, slotId));
      }
    } catch {
      // localStorage unavailable (private mode / SSR) — name is display-only, safe to drop.
    }
  }

  private async requireUserId(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) throw new Error('Please sign in again to use your wallet.');
    return userId;
  }

  private async usageRows(): Promise<UsageRow[]> {
    const { data, error } = await supabase.from('wallet_documents').select('slot_id, file_size');
    if (error) throw new Error(`Failed to check wallet usage: ${error.message}`);
    return (data ?? []) as UsageRow[];
  }

  private async assertWithinCaps(
    slotId: VaultSlotId,
    incomingBytes: number,
    caps: VaultCaps,
  ): Promise<void> {
    const rows = await this.usageRows();
    const inSlot = rows.filter((r) => r.slot_id === slotId).length;
    if (inSlot >= caps.maxFilesPerSlot) {
      throw new Error(
        `This slot already holds its maximum of ${caps.maxFilesPerSlot} files. ` +
          'Remove one to add another, or upgrade for more.',
      );
    }
    const used = rows.reduce((sum, r) => sum + Number(r.file_size), 0);
    if (used + incomingBytes > caps.maxTotalBytes) {
      throw new Error(
        'This file would take your wallet over its storage limit. Remove something, or upgrade for more space.',
      );
    }
  }

  /**
   * Anchor the hash on document_storage with NO transaction id and a generic
   * slot label as the on-chain fileName (so no real filename leaks on-chain).
   */
  private async anchorHash(
    size: number,
    fileHash: string,
    contentType: string,
    slot: VaultSlot,
  ): Promise<number> {
    await icpService.initialize();
    await icpService.ensureDocumentStorageActor();
    if (!icpService.documentStorageActor) {
      throw new Error('document_storage actor not available');
    }
    const csrfToken = await icpService.getDocumentStorageCsrfToken();
    const result = await icpService.documentStorageActor.registerDocumentProof(
      slot.onChainLabel, // generic label — NEVER the real filename or a custom slot name (ADR 0003)
      fileHash,
      BigInt(size),
      contentType,
      'wallet', // held in owner-only account storage; not "onchain" (no chunk upload)
      [], // principal-scoped — no transaction
      slot.id, // docType
      csrfToken,
    );
    if ('err' in result) {
      throw new Error(`Could not anchor document hash: ${result.err}`);
    }
    return Number(result.ok);
  }

  /** Upload the bytes then insert the row; remove the object if the row fails. */
  private async persist(userId: string, input: AnchoredFileInput): Promise<VaultDocument> {
    const objectPath = walletObjectPath(userId, input.slotId, input.fileHash, input.mimeType);
    const { error: upErr } = await supabase.storage
      .from(WALLET_BUCKET)
      .upload(objectPath, input.blob, { contentType: input.mimeType, upsert: false });
    if (upErr && !isDuplicateObject(upErr.message)) {
      throw new Error(`Upload failed: ${upErr.message}`);
    }

    const { data, error } = await supabase
      .from('wallet_documents')
      .insert({
        user_id: userId,
        slot_id: input.slotId,
        file_hash: input.fileHash,
        blockchain_id: input.blockchainId,
        object_path: objectPath,
        file_size: input.fileSize,
        mime_type: input.mimeType,
        label: normaliseLabel(input.label),
      })
      .select()
      .single();
    if (error) {
      await supabase.storage.from(WALLET_BUCKET).remove([objectPath]);
      throw new Error(`Could not save to your wallet: ${error.message}`);
    }
    return mapWalletRow(data as WalletRow);
  }
}

export const vaultDocumentService = new VaultDocumentService();
export default vaultDocumentService;
