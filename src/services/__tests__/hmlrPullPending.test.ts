// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The pending HMLR pull record and its resume claim. The claim is what stops
 * two mounted buttons verifying, pulling or refunding the same paid session.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  HMLR_PENDING_KEY,
  claimResume,
  clearPendingState,
  getPendingTitlePull,
  hasPendingTitlePull,
  isResumeInFlight,
  loadPendingState,
  onResumeReleased,
  releaseResume,
  savePendingState,
  type PendingTitlePull,
} from '../hmlrPullPending';
import { logger } from '@/utils/logger';

const DAY_MS = 24 * 60 * 60 * 1000;

function pending(over: Partial<PendingTitlePull> = {}): PendingTitlePull {
  return { titleNumber: 'GR506405', transactionId: 'tx-1', startedAt: new Date().toISOString(), sessionId: 'cs_test_1', ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  releaseResume('tx-1');
  releaseResume('tx-2');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('pending record', () => {
  it('should round-trip save, load and clear', () => {
    expect(savePendingState(pending())).toBe(true);
    expect(loadPendingState()).toMatchObject({ transactionId: 'tx-1', sessionId: 'cs_test_1' });
    clearPendingState();
    expect(loadPendingState()).toBeNull();
  });

  it('should drop a record older than 24 hours', () => {
    savePendingState(pending({ startedAt: new Date(Date.now() - DAY_MS - 1000).toISOString() }));
    expect(loadPendingState()).toBeNull();
    expect(localStorage.getItem(HMLR_PENDING_KEY)).toBeNull();
  });

  it('should keep a record just inside 24 hours', () => {
    savePendingState(pending({ startedAt: new Date(Date.now() - DAY_MS + 60_000).toISOString() }));
    expect(loadPendingState()).not.toBeNull();
  });

  it('should treat corrupt JSON as nothing pending and remove it', () => {
    localStorage.setItem(HMLR_PENDING_KEY, '{not json');
    expect(loadPendingState()).toBeNull();
    expect(localStorage.getItem(HMLR_PENDING_KEY)).toBeNull();
  });

  it('should treat a missing start time as stale', () => {
    localStorage.setItem(HMLR_PENDING_KEY, JSON.stringify({ transactionId: 'tx-1', titleNumber: 'GR1' }));
    expect(loadPendingState()).toBeNull();
  });

  it('should only report a pending pull for the same transaction', () => {
    savePendingState(pending());
    expect(hasPendingTitlePull('tx-1')).toBe(true);
    expect(hasPendingTitlePull('tx-2')).toBe(false);
    expect(getPendingTitlePull('tx-2')).toBeNull();
  });

  it('should report nothing pending for an undefined transaction id', () => {
    savePendingState(pending());
    expect(hasPendingTitlePull(undefined)).toBe(false);
  });
});

describe('blocked storage', () => {
  // Safari private mode / a locked-down profile: every storage call throws.
  function blockStorage(): void {
    const refuse = (): never => {
      throw new Error('SecurityError');
    };
    vi.stubGlobal('localStorage', { getItem: refuse, setItem: refuse, removeItem: refuse, clear: refuse });
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should read as nothing pending when storage throws', () => {
    blockStorage();
    expect(loadPendingState()).toBeNull();
    expect(hasPendingTitlePull('tx-1')).toBe(false);
    expect(isResumeInFlight('tx-1')).toBe(false);
  });

  it('should log and return false when a save throws', () => {
    blockStorage();
    expect(savePendingState(pending())).toBe(false);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('should not throw when clearing or claiming throws underneath', () => {
    blockStorage();
    expect(() => clearPendingState()).not.toThrow();
    expect(claimResume('tx-1')).toBe(true);
    expect(() => releaseResume('tx-1')).not.toThrow();
  });
});

describe('resume claim', () => {
  it('should refuse a second claim on the same deal until released', () => {
    savePendingState(pending());
    expect(claimResume('tx-1')).toBe(true);
    expect(claimResume('tx-1')).toBe(false);
    expect(isResumeInFlight('tx-1')).toBe(true);
    releaseResume('tx-1');
    expect(isResumeInFlight('tx-1')).toBe(false);
    expect(claimResume('tx-1')).toBe(true);
  });

  it('should not block a different deal', () => {
    expect(claimResume('tx-1')).toBe(true);
    expect(claimResume('tx-2')).toBe(true);
  });

  it('should stamp the stored record so another tab sees the claim, and unstamp on release', () => {
    savePendingState(pending());
    claimResume('tx-1');
    expect(loadPendingState()?.inFlightAt).toBeDefined();
    releaseResume('tx-1');
    expect(loadPendingState()?.inFlightAt).toBeUndefined();
    expect(loadPendingState()?.sessionId).toBe('cs_test_1');
  });

  it("should refuse a claim while another tab's fresh stamp is on the record", () => {
    savePendingState(pending({ inFlightAt: new Date().toISOString() }));
    expect(isResumeInFlight('tx-1')).toBe(true);
    expect(claimResume('tx-1')).toBe(false);
  });

  it('should ignore a stamp left by a tab that died over five minutes ago', () => {
    savePendingState(pending({ inFlightAt: new Date(Date.now() - 6 * 60_000).toISOString() }));
    expect(isResumeInFlight('tx-1')).toBe(false);
    expect(claimResume('tx-1')).toBe(true);
  });

  it('should tell listeners for that deal when the claim is released', () => {
    const forTx1 = vi.fn();
    const forTx2 = vi.fn();
    const off = onResumeReleased('tx-1', forTx1);
    onResumeReleased('tx-2', forTx2)();
    claimResume('tx-1');
    releaseResume('tx-1');
    expect(forTx1).toHaveBeenCalledTimes(1);
    expect(forTx2).not.toHaveBeenCalled();
    off();
    releaseResume('tx-1');
    expect(forTx1).toHaveBeenCalledTimes(1);
  });

  it('should tell listeners when another tab changes the pending record', () => {
    const listener = vi.fn();
    const off = onResumeReleased('tx-1', listener);
    window.dispatchEvent(new StorageEvent('storage', { key: HMLR_PENDING_KEY }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'something-else' }));
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });
});
