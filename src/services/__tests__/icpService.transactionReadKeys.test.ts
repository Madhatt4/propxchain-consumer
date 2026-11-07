import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Records each read's config, so the shared-call keys can be checked.
const readConfigs: Array<{ cacheKey?: string } | undefined> = [];
vi.mock('../canisterRateLimiter', () => ({
  wrapWriteCall: async <T,>(fn: () => Promise<T>): Promise<T> => fn(),
  wrapReadCall: async <T,>(fn: () => Promise<T>, config?: { cacheKey?: string }): Promise<T> => {
    readConfigs.push(config);
    return fn();
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { icpService } from '../icp.service';
import { useAuthStore } from '../../stores/authStore';

type Internals = { transactionManagerActor: Record<string, ReturnType<typeof vi.fn>> | null };
const internals = icpService as unknown as Internals;

describe('icpService transaction reads share one call per caller and deal', () => {
  const actor = {
    getTransaction: vi.fn().mockResolvedValue([]),
    getNextStep: vi.fn().mockResolvedValue({ ok: {} }),
    getFlowState: vi.fn().mockResolvedValue([]),
  };

  beforeEach(() => {
    readConfigs.length = 0;
    useAuthStore.setState({ principalId: 'alice' });
    vi.spyOn(icpService, 'initAuth').mockResolvedValue(true);
    internals.transactionManagerActor = actor;
  });

  afterEach(() => {
    internals.transactionManagerActor = null;
    vi.restoreAllMocks();
  });

  it('should key getTransaction, getNextStep and getFlowState by caller and deal', async () => {
    await icpService.getTransaction('tx_1');
    await icpService.getNextStep('tx_1');
    await icpService.getFlowState('tx_1');

    expect(readConfigs.map((c) => c?.cacheKey)).toEqual([
      'getTransaction:alice:tx_1',
      'getNextStep:alice:tx_1',
      'getFlowState:alice:tx_1',
    ]);
  });

  it('should key getCompletionStatus by caller and deal', async () => {
    const completion = { getCompletionStatus: vi.fn().mockResolvedValue([]) };
    vi.spyOn(icpService as unknown as { completionActor: () => Promise<unknown> }, 'completionActor')
      .mockResolvedValue(completion);

    await icpService.getCompletionStatus('tx_1');

    expect(readConfigs.map((c) => c?.cacheKey)).toEqual(['getCompletionStatus:alice:tx_1']);
  });

  it('should not share a result between two callers', async () => {
    await icpService.getTransaction('tx_1');
    useAuthStore.setState({ principalId: 'bob' });
    await icpService.getTransaction('tx_1');

    expect(readConfigs[0]?.cacheKey).not.toBe(readConfigs[1]?.cacheKey);
  });
});
