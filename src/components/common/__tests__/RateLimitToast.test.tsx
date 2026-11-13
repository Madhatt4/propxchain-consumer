// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getCanisterRateLimiter,
  isRateLimitFailure,
  RATE_LIMIT_FAILURE_MESSAGE,
  RateLimitEvent,
  type RateLimitEventData,
} from '../../../services/canisterRateLimiter';
import { CategoryRateLimiter } from '../../../utils/rateLimiter';
import { RateLimitToast } from '../RateLimitToast';

const toastMock = vi.fn();
vi.mock('../../../hooks/use-toast', () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

// The listener the component registers with the real limiter singleton
let emit: (event: RateLimitEventData) => void;

function event(
  kind: RateLimitEvent,
  timestamp: number,
  error?: string
): RateLimitEventData {
  return {
    event: kind,
    operationType: 'read',
    timestamp,
    details: error === undefined ? undefined : { error },
  };
}

const GAVE_UP = RATE_LIMIT_FAILURE_MESSAGE;

describe('RateLimitToast', () => {
  beforeEach(() => {
    toastMock.mockReset();
    const limiter = getCanisterRateLimiter();
    const add = vi.spyOn(limiter, 'addEventListener');
    render(<RateLimitToast />);
    emit = add.mock.calls[0][0];
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should stay silent when a call is only queued behind the limit', () => {
    emit(event(RateLimitEvent.RATE_LIMITED, 1_000));
    emit(event(RateLimitEvent.QUEUED, 1_001));
    emit(event(RateLimitEvent.SUCCESS, 2_000));

    expect(toastMock).not.toHaveBeenCalled();
  });

  it('should show one red popup when a call gives up waiting', () => {
    emit(event(RateLimitEvent.FAILURE, 30_000, GAVE_UP));

    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', title: 'Still busy' })
    );
  });

  it('should show one popup for a burst of failures, then again after the quiet window', () => {
    emit(event(RateLimitEvent.FAILURE, 30_000, GAVE_UP));
    emit(event(RateLimitEvent.FAILURE, 31_000, GAVE_UP));
    emit(event(RateLimitEvent.FAILURE, 39_999, GAVE_UP));
    expect(toastMock).toHaveBeenCalledTimes(1);

    emit(event(RateLimitEvent.FAILURE, 40_000, GAVE_UP));
    expect(toastMock).toHaveBeenCalledTimes(2);
  });

  it('should ignore failures that are not the rate limiter giving up', () => {
    emit(event(RateLimitEvent.FAILURE, 5_000, 'IC0503: Canister trapped'));

    expect(toastMock).not.toHaveBeenCalled();
  });

  it('should show the popup when a real limiter call gives up waiting', async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(CategoryRateLimiter.prototype, 'acquire').mockReturnValue(false);
      const outcome = getCanisterRateLimiter().call(async () => 'never', {
        operationType: 'write',
      });
      outcome.catch(() => undefined);

      await vi.runAllTimersAsync();

      await expect(outcome).rejects.toThrow(RATE_LIMIT_FAILURE_MESSAGE);
      expect(toastMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('should stop listening when unmounted', () => {
    const limiter = getCanisterRateLimiter();
    const remove = vi.spyOn(limiter, 'removeEventListener');
    const { unmount } = render(<RateLimitToast />);

    unmount();

    expect(remove).toHaveBeenCalledTimes(1);
  });
});

describe('isRateLimitFailure', () => {
  it('should be false for a failure with no error detail', () => {
    expect(isRateLimitFailure(event(RateLimitEvent.FAILURE, 1))).toBe(false);
  });

  it('should be false for a rate-limited event even with the message', () => {
    expect(isRateLimitFailure(event(RateLimitEvent.RATE_LIMITED, 1, GAVE_UP))).toBe(false);
  });
});
