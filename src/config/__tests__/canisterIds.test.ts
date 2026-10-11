// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { describe, it, expect, vi, afterEach } from 'vitest';
import { MAINNET_CANISTER_IDS, MAINNET_PLATFORM_CANISTER_IDS } from '@propxchain/core-client';
import deployManifest from '../../../canister_ids.json';

async function loadFresh(): Promise<typeof import('../canisterIds')> {
  vi.resetModules();
  return import('../canisterIds');
}

describe('canister ID config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should use the IDs core-client publishes when no override is set', async () => {
    // Arrange
    vi.stubEnv('VITE_TRANSACTION_MANAGER_CANISTER_ID', '');
    vi.stubEnv('VITE_MESSAGE_MANAGER_CANISTER_ID', '');

    // Act
    const { CANISTER_IDS, MAINNET_LOGBOOK_CANISTER_ID, CYCLES_WALLET_ID } = await loadFresh();

    // Assert
    expect(CANISTER_IDS.transaction_manager).toBe(MAINNET_CANISTER_IDS.transactionManager);
    expect(CANISTER_IDS.message_manager).toBe(MAINNET_PLATFORM_CANISTER_IDS.messageManager);
    expect(MAINNET_LOGBOOK_CANISTER_ID).toBe(MAINNET_PLATFORM_CANISTER_IDS.propertyLogbook);
    expect(CYCLES_WALLET_ID).toBe(MAINNET_PLATFORM_CANISTER_IDS.cyclesWallet);
  });

  it('should take the frontend canister from this repo deploy manifest', async () => {
    // Arrange
    vi.stubEnv('VITE_ICP_CANISTER_ID', '');

    // Act
    const { CANISTER_IDS } = await loadFresh();

    // Assert
    expect(CANISTER_IDS.frontend).toBe(deployManifest.frontend.ic);
  });

  it('should let a non-empty env value override the published ID', async () => {
    // Arrange
    vi.stubEnv('VITE_USER_MANAGEMENT_CANISTER_ID', '  aaaaa-aa  ');

    // Act
    const { CANISTER_IDS } = await loadFresh();

    // Assert
    expect(CANISTER_IDS.user_management).toBe('aaaaa-aa');
  });

  it('should ignore a whitespace-only override', async () => {
    // Arrange
    vi.stubEnv('VITE_LEDGER_MANAGER_CANISTER_ID', '   ');

    // Act
    const { CANISTER_IDS } = await loadFresh();

    // Assert
    expect(CANISTER_IDS.ledger_manager).toBe(MAINNET_CANISTER_IDS.ledgerManager);
  });
});
