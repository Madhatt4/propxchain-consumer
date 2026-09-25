import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const isTransactionEntitled = vi.fn();
vi.mock('@dfinity/agent', () => ({
  // The real @dfinity/agent (pinned to the version @propxchain/core-client
  // depends on, see src/services/icp.service.ts) constructs HttpAgent via
  // `new HttpAgent(options)`, not a static async `.create` factory.
  HttpAgent: vi.fn().mockImplementation(function HttpAgentMock() {
    return {};
  }),
  Actor: { createActor: () => ({ isTransactionEntitled }) },
}));

import { isChainUnlocked } from '../chainEntitlement.service';

describe('isChainUnlocked', () => {
  beforeEach(() => {
    isTransactionEntitled.mockReset();
    // The service short-circuits to false when the canister id env var is
    // unset (vitest has no VITE_ENTITLEMENT_CANISTER_ID by default) — stub it
    // so the happy-path tests actually reach the mocked actor.
    vi.stubEnv('VITE_ENTITLEMENT_CANISTER_ID', 'aaaaa-aa');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('queries the vmc-chain addonId and returns the boolean', async () => {
    isTransactionEntitled.mockResolvedValue(true);
    expect(await isChainUnlocked('tx-1')).toBe(true);
    expect(isTransactionEntitled).toHaveBeenCalledWith('vmc-chain:tx-1');
  });

  it('fails closed (false) if the query throws', async () => {
    isTransactionEntitled.mockRejectedValue(new Error('boom'));
    expect(await isChainUnlocked('tx-1')).toBe(false);
  });

  it('fails closed (false) without calling the actor when the canister id is unset', async () => {
    vi.stubEnv('VITE_ENTITLEMENT_CANISTER_ID', '');
    isTransactionEntitled.mockResolvedValue(true);
    expect(await isChainUnlocked('tx-1')).toBe(false);
    expect(isTransactionEntitled).not.toHaveBeenCalled();
  });
});
