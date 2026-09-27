import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../canisterRateLimiter', () => ({
  wrapWriteCall: async <T,>(fn: () => Promise<T>): Promise<T> => fn(),
  wrapReadCall: async <T,>(fn: () => Promise<T>): Promise<T> => fn(),
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../stores/authStore', () => ({
  getStorePrincipalId: (): string | null => null,
  getStoreIsAuthenticated: (): boolean => false,
}));

import { Principal } from '@propxchain/core-client';
import { icpService } from '../icp.service';
import { emptyTA7Form } from '../../types/ta7.types';

// The canister stores TA7 money as Nat, so amounts travel as whole pence.
// The form takes pounds with pence (parseFloat), which BigInt() rejected.
type Privates = { transactionManagerActor: Record<string, unknown> | null };

describe('TA7 amounts are stored on-chain in pence', () => {
  const updateTA7 = vi.fn();
  const getTA7 = vi.fn();

  beforeEach(() => {
    updateTA7.mockReset().mockResolvedValue({ ok: null });
    getTA7.mockReset();
    (icpService as unknown as Privates).transactionManagerActor = { updateTA7, getTA7 };
  });

  it('should save pounds-and-pence amounts as whole pence', async () => {
    await icpService.updateTA7('tx_1', { ...emptyTA7Form, groundRentAmount: 125.5, serviceChargeAmount: 1234.56 });

    const sent = updateTA7.mock.calls[0][1];
    expect(sent.groundRentAmount).toBe(12550n);
    expect(sent.serviceChargeAmount).toBe(123456n);
  });

  it('should read whole pence back as pounds', async () => {
    getTA7.mockResolvedValue({
      ok: [{
        leaseTermYears: 125n, leaseStartDate: '', leaseExpiryDate: '',
        groundRentAmount: 12550n, groundRentPaymentFrequency: 'annual',
        serviceChargeAmount: 123456n, serviceChargePaymentFrequency: 'annual',
        freeholder: '', managingAgent: [], restrictions: '',
        alterationsAllowed: false, sublettingAllowed: false, petsAllowed: false,
        completedBy: Principal.anonymous(), completedAt: [],
        lastModifiedBy: Principal.anonymous(), lastModifiedAt: 0n,
      }],
    });

    const form = await icpService.getTA7('tx_1');

    expect(form?.groundRentAmount).toBe(125.5);
    expect(form?.serviceChargeAmount).toBe(1234.56);
  });
});
