// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * One-time migration of legacy device-local wallet files (encrypted IndexedDB,
 * pre-2026-08-18) into owner-only account storage. Hashes were already
 * anchored on-chain, so nothing is re-anchored. Local copies are deleted only
 * after a successful upload; failures leave the local record intact so the
 * user can retry. Runs only on explicit user consent (spec decision 9).
 */
import { localDocumentRegistry } from './localDocumentRegistry';
import { vaultFileStore } from './vaultFileStore';
import { vaultDocumentService } from './vaultDocument.service';
import { VAULT_SLOT_IDS, type VaultDocument, type VaultSlotId } from '../types/vault.types';
import { logger } from '@/utils/logger';

export interface LegacyLocalDoc {
  localId: string;
  slotId: VaultSlotId;
  fileHash: string;
  blockchainId: number;
  mimeType: string;
  fileSize: number;
}

export interface MigrationResult {
  moved: number;
  failed: number;
}

const isVaultSlot = (t: string): t is VaultSlotId =>
  (VAULT_SLOT_IDS as readonly string[]).includes(t);

class VaultMigrationService {
  /** Legacy wallet files this principal still holds on this device. */
  async listLegacy(principal: string): Promise<LegacyLocalDoc[]> {
    let records: Awaited<ReturnType<typeof localDocumentRegistry.getAllRecords>>;
    try {
      records = await localDocumentRegistry.getAllRecords();
    } catch (err) {
      logger.warn('[walletMigration] local registry unavailable', err);
      return [];
    }
    return records
      .filter((r) => r.uploadedBy === principal && isVaultSlot(r.documentType))
      .map((r) => ({
        localId: r.id,
        slotId: r.documentType as VaultSlotId,
        fileHash: r.fileHash,
        blockchainId: r.blockchainId ?? 0,
        mimeType: r.mimeType,
        fileSize: r.fileSize,
      }));
  }

  /** Move every legacy file; `onEach` fires per successful move. */
  async migrateAll(
    principal: string,
    onEach?: (doc: VaultDocument) => void,
  ): Promise<MigrationResult> {
    const legacy = await this.listLegacy(principal);
    let moved = 0;
    let failed = 0;
    for (const item of legacy) {
      try {
        const doc = await this.moveOne(item);
        moved += 1;
        onEach?.(doc);
      } catch (err) {
        failed += 1;
        logger.warn('[walletMigration] could not move a local file', item.localId, err);
      }
    }
    return { moved, failed };
  }

  private async moveOne(item: LegacyLocalDoc): Promise<VaultDocument> {
    const file = await vaultFileStore.getFile(item.localId);
    if (!file) throw new Error('local bytes missing');
    const doc = await vaultDocumentService.importAnchored({
      blob: file.blob,
      slotId: item.slotId,
      fileHash: item.fileHash,
      blockchainId: item.blockchainId,
      mimeType: item.mimeType,
      fileSize: item.fileSize,
    });
    await vaultFileStore.deleteFile(item.localId);
    await localDocumentRegistry.removeDocument(item.localId);
    return doc;
  }
}

export const vaultMigrationService = new VaultMigrationService();
