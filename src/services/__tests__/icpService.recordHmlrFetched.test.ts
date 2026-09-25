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
  transactionManagerActor: { recordHmlrFetched?: ReturnType<typeof vi.fn> } | null;
};

describe('icpService.recordHmlrFetched', () => {
  const recordHmlrFetched = vi.fn();

  beforeEach(() => {
    recordHmlrFetched.mockReset();
    // initAuth touches AuthClient/HttpAgent — stub it out for an isolated unit test.
    vi.spyOn(icpService, 'initAuth').mockResolvedValue(true);
    (icpService as unknown as Internals).transactionManagerActor = { recordHmlrFetched };
  });

  afterEach(() => {
    (icpService as unknown as Internals).transactionManagerActor = null;
    vi.restoreAllMocks();
  });

  it('calls the canister with (txId, titleNumber, responseHash) and returns ok', async () => {
    recordHmlrFetched.mockResolvedValue({ ok: null });

    const result = await icpService.recordHmlrFetched('tx-001', 'GR506405', 'abc123');

    expect(recordHmlrFetched).toHaveBeenCalledWith('tx-001', 'GR506405', 'abc123');
    expect(result).toEqual({ ok: null });
  });

  it('returns (does not throw) the canister err so the caller can treat it as non-fatal', async () => {
    recordHmlrFetched.mockResolvedValue({ err: 'Only the seller, their conveyancer, or the platform can record an HMLR fetch' });

    const result = await icpService.recordHmlrFetched('tx-001', 'GR506405', 'abc123');

    expect(result).toHaveProperty('err');
  });

  it('soft no-op (returns err) when the published core-client IDL predates the method', async () => {
    // Actor present but without the method — the canary has not yet shipped it.
    (icpService as unknown as Internals).transactionManagerActor = {};

    const result = await icpService.recordHmlrFetched('tx-001', 'GR506405', 'abc123');

    expect(result).toHaveProperty('err');
    expect(recordHmlrFetched).not.toHaveBeenCalled();
  });
});
