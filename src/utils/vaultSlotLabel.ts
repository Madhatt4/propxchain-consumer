// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * The display label for a vault slot. For custom slots this is the user's local
 * name (kept on-device, never on-chain — ADR 0003), falling back to the slot's
 * default label when unnamed.
 */
import { VAULT_SLOTS, type VaultSlotId } from '@/types/vault.types';
import { vaultDocumentService } from '@/services/vaultDocument.service';

export function slotDisplayLabel(slotId: VaultSlotId, principal: string): string {
  const slot = VAULT_SLOTS.find((s) => s.id === slotId);
  if (!slot) return slotId;
  if (slot.custom) {
    return vaultDocumentService.getCustomSlotName(principal, slotId) ?? slot.label;
  }
  return slot.label;
}
