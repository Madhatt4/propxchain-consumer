// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * wallet_documents row shapes and the row → VaultDocument mapper.
 */
import { vaultDocumentSchema, type VaultDocument, type VaultSlotId } from '../types/vault.types';

export interface WalletRow {
  id: string;
  slot_id: VaultSlotId;
  blockchain_id: number;
  file_hash: string;
  object_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  label?: string | null;
}

export interface UsageRow {
  slot_id: string;
  file_size: number;
}

export function mapWalletRow(r: WalletRow): VaultDocument {
  return vaultDocumentSchema.parse({
    id: r.id,
    slotId: r.slot_id,
    blockchainId: Number(r.blockchain_id),
    fileHash: r.file_hash,
    fileSize: Number(r.file_size),
    mimeType: r.mime_type,
    uploadedAt: r.created_at,
    objectPath: r.object_path,
    ...(r.label ? { label: r.label } : {}),
  });
}

