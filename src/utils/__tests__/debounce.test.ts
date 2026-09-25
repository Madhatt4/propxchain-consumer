// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { debounce, throttle, debounceAsync } from '../debounce';

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

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Functionality', () => {
    it('should delay function execution until after wait period', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should reset timer on each call', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      vi.advanceTimersByTime(50);

      debounced();
      vi.advanceTimersByTime(50);
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass correct arguments to debounced function', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced('arg1', 'arg2', 123);
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2', 123);
    });

    it('should use the latest arguments when called multiple times', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced('first');
      debounced('second');
      debounced('third');

      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('third');
    });
  });

  describe('Leading Edge Option', () => {
    it('should invoke on leading edge when enabled', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100, { leading: true, trailing: false });

      debounced();
      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should invoke on both edges when both enabled', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100, { leading: true, trailing: true });

      debounced();
      expect(fn).toHaveBeenCalledTimes(1); // Leading edge

      debounced(); // Call again to trigger trailing edge

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(2); // Trailing edge
    });

    it('should only invoke on leading edge for rapid calls', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100, { leading: true, trailing: false });

      debounced();
      expect(fn).toHaveBeenCalledTimes(1);

      debounced();
      debounced();
      debounced();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1); // No trailing call
    });
  });

  describe('MaxWait Option', () => {
    it('should invoke function after maxWait even with continuous calls', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 200, { maxWait: 500 });

      // Start the debounce
      debounced();

      // Keep calling every 150ms (before debounce expires)
      vi.advanceTimersByTime(150);
      debounced();

      vi.advanceTimersByTime(150);
      debounced();

      vi.advanceTimersByTime(150);
      debounced();

      // Now advance beyond maxWait
      vi.advanceTimersByTime(200);

      // Function should have been called due to maxWait
      expect(fn).toHaveBeenCalled();
    });
  });

  describe('Cancel Functionality', () => {
    it('should cancel pending invocation', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced.cancel();

      vi.advanceTimersByTime(100);
      expect(fn).not.toHaveBeenCalled();
    });

    it('should allow new calls after cancel', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced.cancel();

      debounced();
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Flush Functionality', () => {
    it('should immediately invoke pending function', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      vi.advanceTimersByTime(50);

      debounced.flush();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should do nothing if no pending invocation', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced.flush();
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('Pending Check', () => {
    it('should return true when invocation is pending', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      expect(debounced.pending()).toBe(false);

      debounced();
      expect(debounced.pending()).toBe(true);

      vi.advanceTimersByTime(100);
      expect(debounced.pending()).toBe(false);
    });

    it('should return false after cancel', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      expect(debounced.pending()).toBe(true);

      debounced.cancel();
      expect(debounced.pending()).toBe(false);
    });
  });
});

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Functionality', () => {
    it('should invoke function at most once per interval', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled();
      expect(fn).toHaveBeenCalledTimes(1);

      throttled();
      throttled();
      throttled();
      expect(fn).toHaveBeenCalledTimes(1); // Still only once

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(2); // Trailing call
    });

    it('should pass correct arguments to throttled function', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled('arg1', 'arg2');
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should use latest arguments for trailing call', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled('first');
      throttled('second');
      throttled('third');

      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith('third');
    });

    it('should allow invocation after throttle period', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled();
      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);

      throttled();
      expect(fn).toHaveBeenCalledTimes(2); // Can call again after period
    });
  });

  describe('Leading Edge Option', () => {
    it('should not invoke on leading edge when disabled', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100, { leading: false });

      throttled();
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1); // Only trailing call
    });

    it('should invoke on leading edge when enabled', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100, { leading: true });

      throttled();
      expect(fn).toHaveBeenCalledTimes(1); // Leading edge
    });
  });

  describe('Trailing Edge Option', () => {
    it('should not invoke on trailing edge when disabled', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100, { trailing: false });

      throttled();
      expect(fn).toHaveBeenCalledTimes(1); // Leading edge

      throttled();
      throttled();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1); // No trailing call
    });
  });

  describe('Cancel Functionality', () => {
    it('should cancel pending trailing invocation', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled();
      expect(fn).toHaveBeenCalledTimes(1);

      throttled();
      throttled.cancel();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1); // No trailing call
    });
  });

  describe('Pending Check', () => {
    it('should return true when trailing call is pending', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      expect(throttled.pending()).toBe(false);

      throttled();
      throttled();
      expect(throttled.pending()).toBe(true);

      vi.advanceTimersByTime(100);
      expect(throttled.pending()).toBe(false);
    });
  });
});

describe('debounceAsync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Promise Handling', () => {
    it('should return a promise that resolves with function result', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      const debounced = debounceAsync(fn, 100);

      const promise = debounced();
      vi.advanceTimersByTime(100);

      const result = await promise;
      expect(result).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should reject promise when function throws', async () => {
      const error = new Error('test error');
      const fn = vi.fn().mockRejectedValue(error);
      const debounced = debounceAsync(fn, 100);

      const promise = debounced();
      vi.advanceTimersByTime(100);

      await expect(promise).rejects.toThrow('test error');
    });

    it('should handle multiple calls with single execution', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      const debounced = debounceAsync(fn, 100);

      // All calls share the same promise resolution
      debounced('arg1');
      debounced('arg2');
      const finalPromise = debounced('arg3');

      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      const result = await finalPromise;

      expect(result).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('arg3'); // Latest args
    }, 10000);

    it('should settle every caller inside the window, not just the last', async () => {
      // `pendingPromise` used to be a single slot overwritten by each call, so
      // the first two callers' promises never settled at all. Live in
      // icp.service.getAllTransactions() at 500ms: a double-mount left one
      // caller awaiting forever, i.e. a spinner that never cleared.
      const fn = vi.fn().mockResolvedValue('result');
      const debounced = debounceAsync(fn, 100);

      const settled: string[] = [];
      void debounced('a').then((v) => void settled.push(`first:${v}`));
      void debounced('b').then((v) => void settled.push(`second:${v}`));
      void debounced('c').then((v) => void settled.push(`third:${v}`));

      await vi.advanceTimersByTimeAsync(100);
      await vi.runAllTimersAsync();

      // Every waiter gets the result of the one invocation that actually ran,
      // in the order they queued.
      expect(settled).toEqual(['first:result', 'second:result', 'third:result']);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('c');
    }, 10000);

    it('should reject every caller inside the window, not just the last', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('boom'));
      const debounced = debounceAsync(fn, 100);

      const seen: string[] = [];
      void debounced('a').catch((e: Error) => void seen.push(`first:${e.message}`));
      void debounced('b').catch((e: Error) => void seen.push(`second:${e.message}`));

      await vi.advanceTimersByTimeAsync(100);
      await vi.runAllTimersAsync();

      expect(seen).toEqual(['first:boom', 'second:boom']);
    }, 10000);

    it('should not settle a caller that arrives while the previous run is in flight', async () => {
      // The queue is detached before awaiting, so a caller who asks AFTER the
      // invocation started is not handed a result computed before they asked.
      // They wait for the next run instead.
      let releaseFirst: (value: string) => void = () => {};
      const fn = vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<string>((res) => {
              releaseFirst = res;
            }),
        )
        .mockResolvedValue('second-run');
      const debounced = debounceAsync(fn, 100);

      const settled: string[] = [];
      void debounced('a').then((v) => void settled.push(`a:${v}`));

      // First invocation is now running and awaiting `func`.
      await vi.advanceTimersByTimeAsync(100);

      void debounced('b').then((v) => void settled.push(`b:${v}`));

      releaseFirst('first-run');
      // Advance by 1ms, not runAllTimers: that would also fire the 100ms timer
      // 'b' just scheduled and hide the very thing under test. This only
      // flushes the microtasks that settle the first run.
      await vi.advanceTimersByTimeAsync(1);

      // 'b' asked mid-flight, so the first run must not have settled it.
      expect(settled).toEqual(['a:first-run']);

      await vi.advanceTimersByTimeAsync(100);
      await vi.runAllTimersAsync();

      expect(settled).toEqual(['a:first-run', 'b:second-run']);
      expect(fn).toHaveBeenCalledTimes(2);
    }, 10000);

    it('should forward `this` to the wrapped async function', async () => {
      // The inner wrapper was an arrow function, so it ignored the `this`
      // debounce() applied to it, and then called func() bare.
      const context = { name: 'ctx' };
      let runs = 0;
      // Asserted inside rather than captured to an outer variable, which would
      // be a `this` alias. `runs` guards against passing vacuously if the
      // function is never invoked at all.
      async function fn(this: unknown): Promise<string> {
        expect(this).toBe(context);
        runs += 1;
        return 'ok';
      }
      const debounced = debounceAsync(fn, 100);

      const promise = debounced.call(context);
      await vi.advanceTimersByTimeAsync(100);
      await vi.runAllTimersAsync();
      await promise;

      expect(runs).toBe(1);
    }, 10000);

    it('should pass arguments correctly', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      const debounced = debounceAsync(fn, 100);

      debounced('test', 123, { key: 'value' });
      vi.advanceTimersByTime(100);

      await vi.runAllTimersAsync();

      expect(fn).toHaveBeenCalledWith('test', 123, { key: 'value' });
    });
  });

  describe('Leading Edge Support', () => {
    it('should support leading edge execution', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      const debounced = debounceAsync(fn, 100, { leading: true });

      const promise = debounced();

      await vi.runAllTimersAsync();

      const result = await promise;
      expect(result).toBe('result');
      expect(fn).toHaveBeenCalled();
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

  it('should handle rapid search input with debounce', () => {
    const searchFn = vi.fn();
    const debouncedSearch = debounce(searchFn, 300);

    // Simulate rapid typing
    'test query'.split('').forEach((_char, i) => {
      debouncedSearch('test query'.slice(0, i + 1));
      vi.advanceTimersByTime(50);
    });

    expect(searchFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(searchFn).toHaveBeenCalledTimes(1);
    expect(searchFn).toHaveBeenCalledWith('test query');
  });

  it('should handle scroll events with throttle', () => {
    const scrollHandler = vi.fn();
    const throttledScroll = throttle(scrollHandler, 100);

    // Simulate many scroll events
    for (let i = 0; i < 50; i++) {
      throttledScroll(i);
      vi.advanceTimersByTime(10);
    }

    // Should only call a few times, not 50 times
    expect(scrollHandler.mock.calls.length).toBeLessThan(10);
  });

  it('should handle API call debouncing', async () => {
    const apiCall = vi.fn().mockResolvedValue({ data: 'result' });
    const debouncedApi = debounceAsync(apiCall, 500);

    // Simulate rapid button clicks
    debouncedApi();
    vi.advanceTimersByTime(100);
    debouncedApi();
    vi.advanceTimersByTime(100);
    const promise = debouncedApi();

    vi.advanceTimersByTime(500);
    await vi.runAllTimersAsync();

    const result = await promise;
    expect(result).toEqual({ data: 'result' });
    expect(apiCall).toHaveBeenCalledTimes(1);
  });
});
