// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import {
  retryWithBackoff,
  retryWithBackoffAbortable,
  isRateLimitError,
  isRetryableError,
  calculateBackoffDelay,
  createDefaultRetry,
  createRateLimitRetry,
  createQuickRetry
} from '../retryWithBackoff';

// Suppress unhandled rejection warnings for intentional test rejections
const silentHandler = () => {
  // Intentionally empty - silently catch rejections in tests
};

beforeAll(() => {
  // Add silent handler to suppress warnings for intentional rejections
  process.on('unhandledRejection', silentHandler);
});

afterAll(() => {
  // Remove silent handler
  process.off('unhandledRejection', silentHandler);
});

describe('retryWithBackoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Retry Logic', () => {
    it('should succeed on first attempt without retrying', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const resultPromise = retryWithBackoff(fn, { maxRetries: 3 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.value).toBe('success');
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValueOnce('success');

      const resultPromise = retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelayMs: 100
      });

      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.value).toBe('success');
      expect(result.attempts).toBe(3);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max retries exhausted', async () => {
      const error = new Error('network error');
      const fn = vi.fn().mockRejectedValue(error);

      const resultPromise = retryWithBackoff(fn, {
        maxRetries: 2,
        baseDelayMs: 100
      });

      await vi.runAllTimersAsync();

      await expect(resultPromise).rejects.toThrow('network error');
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should not retry non-retryable errors', async () => {
      const error = new Error('validation error');
      const fn = vi.fn().mockRejectedValue(error);

      const resultPromise = retryWithBackoff(fn, {
        maxRetries: 3,
        isRetryable: () => false
      });

      await expect(resultPromise).rejects.toThrow('validation error');
      expect(fn).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe('Exponential Backoff', () => {
    it('should increase delay exponentially', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('network error'));
      const delays: number[] = [];

      retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelayMs: 100,
        maxDelayMs: 10000,
        jitter: false,
        onRetry: (_attempt, delay) => {
          delays.push(delay);
        }
      });

      await vi.runAllTimersAsync();

      // Expect exponential growth: 100, 200, 400
      expect(delays[0]).toBe(100);
      expect(delays[1]).toBe(200);
      expect(delays[2]).toBe(400);
    });

    it('should cap delay at maxDelayMs', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('network error'));
      const delays: number[] = [];

      retryWithBackoff(fn, {
        maxRetries: 5,
        baseDelayMs: 1000,
        maxDelayMs: 3000,
        jitter: false,
        onRetry: (_attempt, delay) => {
          delays.push(delay);
        }
      });

      await vi.runAllTimersAsync();

      // All delays should be capped at 3000
      delays.forEach(delay => {
        expect(delay).toBeLessThanOrEqual(3000);
      });
    });

    it('should add jitter when enabled', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('network error'));
      const delays: number[] = [];

      retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        jitter: true,
        onRetry: (_attempt, delay) => {
          delays.push(delay);
        }
      });

      await vi.runAllTimersAsync();

      // With jitter, delays should vary (not exact exponential)
      expect(delays[0]).toBeGreaterThan(500); // At least 50% of base
      expect(delays[0]).toBeLessThan(1000); // But less than base
    });
  });

  describe('Retry Callback', () => {
    it('should call onRetry callback before each retry', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('network error 1'))
        .mockRejectedValueOnce(new Error('network error 2'))
        .mockResolvedValueOnce('success');

      const onRetry = vi.fn();

      const resultPromise = retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelayMs: 100,
        onRetry
      });

      await vi.runAllTimersAsync();
      await resultPromise;

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledWith(0, expect.any(Number), expect.any(Error));
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Number), expect.any(Error));
    });
  });

  describe('Total Time Tracking', () => {
    it('should track total time spent retrying', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce('success');

      const startTime = Date.now();

      const resultPromise = retryWithBackoff(fn, {
        maxRetries: 2,
        baseDelayMs: 100,
        jitter: false
      });

      await vi.runAllTimersAsync();
      const result = await resultPromise;

      const endTime = Date.now();
      const actualTime = endTime - startTime;

      expect(result.totalTimeMs).toBeGreaterThan(0);
      expect(result.totalTimeMs).toBeLessThanOrEqual(actualTime + 50); // Allow some variance
    });
  });
});

describe('retryWithBackoffAbortable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Abort Functionality', () => {
    it('should abort retry operation', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('network error'));

      const { promise, abort, isAborted } = retryWithBackoffAbortable(fn, {
        maxRetries: 5,
        baseDelayMs: 1000
      });

      expect(isAborted()).toBe(false);

      // Advance a bit then abort
      await vi.advanceTimersByTimeAsync(500);
      abort();

      expect(isAborted()).toBe(true);

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow(/aborted/);
    });

    it('should stop retrying after abort', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('network error'));

      const { promise, abort } = retryWithBackoffAbortable(fn, {
        maxRetries: 10,
        baseDelayMs: 100
      });

      // Let it fail once
      await vi.advanceTimersByTimeAsync(150);

      abort();

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow(/aborted/);

      // Should not retry many times after abort
      expect(fn.mock.calls.length).toBeLessThan(5);
    });

    it('should allow abortion before any attempt', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('network error'));

      const { promise, abort } = retryWithBackoffAbortable(fn, {
        maxRetries: 3
      });

      abort();

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow(/aborted/);
    });
  });
});

describe('isRateLimitError', () => {
  it('should detect HTTP 429 status code', () => {
    expect(isRateLimitError({ status: 429 })).toBe(true);
    expect(isRateLimitError({ statusCode: 429 })).toBe(true);
  });

  it('should detect rate limit keywords in error message', () => {
    expect(isRateLimitError(new Error('Rate limit exceeded'))).toBe(true);
    expect(isRateLimitError(new Error('Too many requests'))).toBe(true);
    expect(isRateLimitError(new Error('Throttle limit reached'))).toBe(true);
    expect(isRateLimitError(new Error('Quota exceeded'))).toBe(true);
    expect(isRateLimitError(new Error('Request limit hit'))).toBe(true);
    expect(isRateLimitError(new Error('Call limit reached'))).toBe(true);
  });

  it('should detect ICP-specific error codes', () => {
    expect(isRateLimitError({ code: 'IC0301' })).toBe(true);
    expect(isRateLimitError({ code: 'IC0503' })).toBe(true);
  });

  it('should return false for non-rate-limit errors', () => {
    expect(isRateLimitError(new Error('Network error'))).toBe(false);
    expect(isRateLimitError({ status: 500 })).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
  });
});

describe('isRetryableError', () => {
  it('should return true for rate limit errors', () => {
    expect(isRetryableError({ status: 429 })).toBe(true);
    expect(isRetryableError(new Error('Rate limit exceeded'))).toBe(true);
  });

  it('should return true for network errors', () => {
    expect(isRetryableError(new Error('Network error'))).toBe(true);
    expect(isRetryableError(new Error('timeout occurred'))).toBe(true);
    expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
    expect(isRetryableError(new Error('ENOTFOUND'))).toBe(true);
    expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
    expect(isRetryableError(new Error('fetch failed'))).toBe(true);
  });

  it('should return true for retryable HTTP status codes', () => {
    expect(isRetryableError({ status: 408 })).toBe(true); // Request Timeout
    expect(isRetryableError({ status: 429 })).toBe(true); // Too Many Requests
    expect(isRetryableError({ status: 500 })).toBe(true); // Internal Server Error
    expect(isRetryableError({ status: 502 })).toBe(true); // Bad Gateway
    expect(isRetryableError({ status: 503 })).toBe(true); // Service Unavailable
    expect(isRetryableError({ status: 504 })).toBe(true); // Gateway Timeout
  });

  it('should return false for non-retryable errors', () => {
    expect(isRetryableError({ status: 400 })).toBe(false); // Bad Request
    expect(isRetryableError({ status: 401 })).toBe(false); // Unauthorized
    expect(isRetryableError({ status: 404 })).toBe(false); // Not Found
    expect(isRetryableError(new Error('Validation failed'))).toBe(false);
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
  });
});

describe('calculateBackoffDelay', () => {
  it('should calculate exponential backoff without jitter', () => {
    expect(calculateBackoffDelay(0, 1000, 10000, false)).toBe(1000); // 1000 * 2^0
    expect(calculateBackoffDelay(1, 1000, 10000, false)).toBe(2000); // 1000 * 2^1
    expect(calculateBackoffDelay(2, 1000, 10000, false)).toBe(4000); // 1000 * 2^2
    expect(calculateBackoffDelay(3, 1000, 10000, false)).toBe(8000); // 1000 * 2^3
  });

  it('should cap delay at maxDelayMs', () => {
    expect(calculateBackoffDelay(10, 1000, 5000, false)).toBe(5000);
    expect(calculateBackoffDelay(20, 1000, 3000, false)).toBe(3000);
  });

  it('should add jitter when enabled', () => {
    const delay1 = calculateBackoffDelay(2, 1000, 10000, true);
    const delay2 = calculateBackoffDelay(2, 1000, 10000, true);

    // Both should be in range [2000, 4000] with jitter
    expect(delay1).toBeGreaterThanOrEqual(2000);
    expect(delay1).toBeLessThanOrEqual(4000);
    expect(delay2).toBeGreaterThanOrEqual(2000);
    expect(delay2).toBeLessThanOrEqual(4000);

    // With jitter, results should vary
    // Note: This might occasionally be the same, but very unlikely
  });

  it('should handle zero attempt', () => {
    expect(calculateBackoffDelay(0, 500, 5000, false)).toBe(500);
  });
});

describe('Helper Functions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createDefaultRetry', () => {
    it('should use default configuration', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const resultPromise = createDefaultRetry(fn);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.value).toBe('success');
    });

    it('should allow custom overrides', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce('success');

      const onRetry = vi.fn();

      const resultPromise = createDefaultRetry(fn, {
        onRetry
      });

      await vi.runAllTimersAsync();
      await resultPromise;

      expect(onRetry).toHaveBeenCalled();
    });
  });

  describe('createRateLimitRetry', () => {
    it('should use rate limit optimized configuration', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const resultPromise = createRateLimitRetry(fn);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.value).toBe('success');
    });

    it('should only retry on rate limit errors', async () => {
      const networkError = new Error('network failure');
      const fn = vi.fn().mockRejectedValue(networkError);

      const resultPromise = createRateLimitRetry(fn);
      await vi.runAllTimersAsync();

      await expect(resultPromise).rejects.toThrow('network failure');
      expect(fn).toHaveBeenCalledTimes(1); // No retries for non-rate-limit errors
    });

    it('should retry rate limit errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      const fn = vi.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce('success');

      const resultPromise = createRateLimitRetry(fn);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.value).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2); // Retried once
    });
  });

  describe('createQuickRetry', () => {
    it('should use quick retry configuration', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const resultPromise = createQuickRetry(fn);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.value).toBe('success');
    });

    it('should have fewer retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('network error'));

      const resultPromise = createQuickRetry(fn);
      await vi.runAllTimersAsync();

      await expect(resultPromise).rejects.toThrow('network error');
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries (maxRetries: 2)
    });
  });
});

describe('Real-world Scenarios', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should handle intermittent network failures', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce({ data: 'success' });

    const resultPromise = retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 100
    });

    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.value).toEqual({ data: 'success' });
    expect(result.attempts).toBe(3);
  });

  it('should handle ICP canister rate limiting', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ status: 429, message: 'Too many requests' })
      .mockRejectedValueOnce({ code: 'IC0503', message: 'Canister rejected' })
      .mockResolvedValueOnce({ transactions: [] });

    const resultPromise = retryWithBackoff(fn, {
      maxRetries: 5,
      baseDelayMs: 1000,
      maxDelayMs: 10000
    });

    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.value).toEqual({ transactions: [] });
    expect(result.attempts).toBe(3);
  });

  it('should fail fast on validation errors', async () => {
    const validationError = new Error('Invalid input');
    const fn = vi.fn().mockRejectedValue(validationError);

    const resultPromise = retryWithBackoff(fn, {
      maxRetries: 5,
      isRetryable: (error) => !error.message.includes('Invalid')
    });

    await expect(resultPromise).rejects.toThrow('Invalid input');
    expect(fn).toHaveBeenCalledTimes(1); // No retries for validation errors
  });
});
