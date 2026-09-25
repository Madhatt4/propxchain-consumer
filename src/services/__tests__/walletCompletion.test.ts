import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));
const mockGetTransaction = vi.fn();
vi.mock('../icp.service', () => ({ icpService: { getTransaction: (...a: unknown[]) => mockGetTransaction(...a) } }));
const mockSchedule = vi.fn();
const mockExpire = vi.fn();
vi.mock('../documentShare.service', () => ({
  documentShareService: {
    scheduleExpiryForDeal: (...a: unknown[]) => mockSchedule(...a),
    expireOverdue: (...a: unknown[]) => mockExpire(...a),
  },
}));

import { applyCompletionLifecycle, statusIsCompletionStarted } from '../walletCompletion';

beforeEach(() => {
  vi.clearAllMocks();
  mockExpire.mockResolvedValue(0);
});

describe('statusIsCompletionStarted', () => {
  it('should be true from completion_initiated onwards and false before', () => {
    expect(statusIsCompletionStarted({ completion_initiated: null })).toBe(true);
    expect(statusIsCompletionStarted({ blockchain_completed: null })).toBe(true);
    expect(statusIsCompletionStarted({ exchanged: null })).toBe(false);
    expect(statusIsCompletionStarted(null)).toBe(false);
  });
});

describe('applyCompletionLifecycle', () => {
  it('should schedule expiry and sweep when the deal has completed', async () => {
    mockGetTransaction.mockResolvedValue({ status: { completion_initiated: null } });
    mockSchedule.mockResolvedValue('2026-09-15T12:00:00.000Z');
    mockExpire.mockResolvedValue(2);
    await expect(applyCompletionLifecycle('tx1')).resolves.toEqual({
      isCompleted: true,
      accessEndsAt: '2026-09-15T12:00:00.000Z',
      expiredNow: 2,
    });
    expect(mockSchedule).toHaveBeenCalledWith('tx1');
  });

  it('should only sweep (never schedule) when the deal is still live', async () => {
    mockGetTransaction.mockResolvedValue({ status: { active: null } });
    const r = await applyCompletionLifecycle('tx1');
    expect(r.isCompleted).toBe(false);
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockExpire).toHaveBeenCalledWith('tx1');
  });

  it('should never throw when the canister lookup fails', async () => {
    mockGetTransaction.mockRejectedValue(new Error('down'));
    await expect(applyCompletionLifecycle('tx1')).resolves.toMatchObject({ isCompleted: false });
  });
});
