// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Pass-through rate limiter so we test the method logic directly
vi.mock('../canisterRateLimiter', () => ({
  wrapWriteCall: async <T,>(fn: () => Promise<T>): Promise<T> => fn(),
  wrapReadCall: async <T,>(fn: () => Promise<T>): Promise<T> => fn(),
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { icpService } from '../icp.service';

type Internals = {
  transactionManagerActor: Record<string, ReturnType<typeof vi.fn>> | null;
};

describe("icpService — the buyer's conveyancer's records", () => {
  const getDepositSent = vi.fn();
  const getRegistrationStatus = vi.fn();

  beforeEach(() => {
    getDepositSent.mockReset();
    getRegistrationStatus.mockReset();
    (icpService as unknown as Internals).transactionManagerActor = { getDepositSent, getRegistrationStatus };
  });

  afterEach(() => {
    (icpService as unknown as Internals).transactionManagerActor = null;
    vi.restoreAllMocks();
  });

  it('should read deposit sent for the deal and unwrap the Candid options', async () => {
    getDepositSent.mockResolvedValue([{ depositSent: [{ sentOn: '2026-11-12', recordedAt: 5n, amountPence: [100n] }] }]);

    const result = await icpService.getDepositSent('tx-001');

    expect(getDepositSent).toHaveBeenCalledWith('tx-001');
    expect(result).toEqual({ sentOn: '2026-11-12', amountPence: 100 });
  });

  it('should read the registration status for the deal', async () => {
    getRegistrationStatus.mockResolvedValue([{
      completedAt: [], submittedOn: [], nextReminderAt: [], applicationReference: [], awaitingApplication: false, remindersDue: 0n,
    }]);

    const result = await icpService.getRegistrationStatus('tx-001');

    expect(getRegistrationStatus).toHaveBeenCalledWith('tx-001');
    expect(result).toEqual({ completedAt: null, awaitingApplication: false, submittedOn: null, applicationReference: null });
  });

  it('should reject when the canister call fails, so the caller can show nothing', async () => {
    getDepositSent.mockRejectedValue(new Error('IC0536: method not found'));

    await expect(icpService.getDepositSent('tx-001')).rejects.toThrow('IC0536');
  });
});
