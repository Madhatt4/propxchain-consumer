// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import type { VaultCaps } from '@/services/vaultDocument.service';

/**
 * Max files a user may hold per Main Wallet slot. Each file writes its own
 * on-chain anchor, so the cap bounds per-user canister writes. One value for
 * everyone since the platform went free (2026-10-15): the old paid-tier cap.
 */
const VAULT_FILES_PER_SLOT = 30;

/** Total wallet bytes a user may hold (wallet spec 2026-08-18, decision 16). */
const VAULT_TOTAL_BYTES = 1024 * 1024 * 1024;

/** The wallet limits every upload path passes to vaultDocumentService. */
export const VAULT_CAPS: VaultCaps = {
  maxFilesPerSlot: VAULT_FILES_PER_SLOT,
  maxTotalBytes: VAULT_TOTAL_BYTES,
};
