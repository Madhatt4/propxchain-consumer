import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../stores/authStore', () => ({
  getStorePrincipalId: (): string | null => null,
  getStoreIsAuthenticated: (): boolean => false,
}));

import { icpService } from '../icp.service';

// useTransactionFlow retries a failed on-chain save once and then tells the
// user "saved locally but failed to record on-chain". That only works if
// setFlowState reports failure; it used to log and return normally.
type Privates = { transactionManagerActor: Record<string, unknown> | null };

const STATE = { completedStages: { 'seller-1': 1 }, providerSelections: {} };

describe('icpService.setFlowState', () => {
  const setFlowState = vi.fn();

  beforeEach(() => {
    vi.spyOn(icpService, 'initAuth').mockResolvedValue(true);
    setFlowState.mockReset();
    (icpService as unknown as Privates).transactionManagerActor = { setFlowState };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should reject when the canister refuses the write', async () => {
    setFlowState.mockResolvedValue({ err: 'not a party to this transaction' });

    await expect(icpService.setFlowState('tx_1', STATE)).rejects.toThrow(/not a party/);
  });

  it('should reject when the call itself fails', async () => {
    setFlowState.mockRejectedValue(new Error('replica unreachable'));

    await expect(icpService.setFlowState('tx_1', STATE)).rejects.toThrow(/replica unreachable/);
  });

  it('should resolve when the canister accepts the write', async () => {
    setFlowState.mockResolvedValue({ ok: null });

    await expect(icpService.setFlowState('tx_1', STATE)).resolves.toBeUndefined();
  });
});
