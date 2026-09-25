// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Debounce and Throttle Utilities for PropXchain
 *
 * Provides timing control for canister calls to prevent excessive requests.
 * - Debounce: Delays execution until after a quiet period
 * - Throttle: Limits execution to once per time interval
 */

/**
 * The constraint for "any function", used by every wrapper below.
 *
 * The parameter list must be `any[]` and cannot be `unknown[]`. Parameters are
 * checked contravariantly, so `(id: string) => void` is NOT assignable to
 * `(...args: unknown[]) => unknown` — switching to `unknown[]` would reject
 * every real caller of debounce() and throttle(). `any[]` in a generic
 * CONSTRAINT is the documented TypeScript idiom for this and never widens the
 * wrapped function's own signature: callers still get `Parameters<T>` and
 * `ReturnType<T>` exactly.
 *
 * The return type is a different matter — returns are covariant, so it is
 * `unknown` here rather than `any`, and the two aliases keep the single
 * unavoidable `any` in one justified place instead of ten scattered ones.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above: an `unknown[]` parameter list would reject every caller
type AnyFunction = (...args: any[]) => unknown;

/** As {@link AnyFunction}, for the async wrapper. Same reasoning. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see AnyFunction
type AnyAsyncFunction = (...args: any[]) => Promise<unknown>;

/**
 * Configuration options for debounce function
 */
export interface DebounceOptions {
  /** If true, invoke on the leading edge instead of trailing */
  leading?: boolean;
  /** If true, invoke on the trailing edge (default: true) */
  trailing?: boolean;
  /** Maximum time function can be delayed before forced execution */
  maxWait?: number;
}

/**
 * Debounced function with cancel and flush methods
 */
export interface DebouncedFunction<T extends AnyFunction> {
  /** The debounced function */
  (...args: Parameters<T>): void;
  /** Cancel any pending invocations */
  cancel(): void;
  /** Immediately invoke any pending invocation */
  flush(): void;
  /** Check if there's a pending invocation */
  pending(): boolean;
}

/**
 * Configuration options for throttle function
 */
export interface ThrottleOptions {
  /** If true, invoke on the leading edge (default: true) */
  leading?: boolean;
  /** If true, invoke on the trailing edge (default: true) */
  trailing?: boolean;
}

/**
 * Throttled function with cancel method
 */
export interface ThrottledFunction<T extends AnyFunction> {
  /** The throttled function */
  (...args: Parameters<T>): void;
  /** Cancel any pending invocations */
  cancel(): void;
  /** Check if there's a pending invocation */
  pending(): boolean;
}

/**
 * Creates a debounced function that delays invoking func until after wait
 * milliseconds have elapsed since the last time the debounced function was invoked.
 *
 * Useful for scenarios like search inputs or repeated API calls where you want
 * to wait for the user to finish their action before executing.
 *
 * @param func - The function to debounce
 * @param wait - The number of milliseconds to delay
 * @param options - Configuration options
 * @returns A debounced version of the function with cancel and flush methods
 *
 * @example
 * ```typescript
 * // Debounce getAllTransactions to prevent rapid repeated calls
 * const debouncedFetch = debounce(
 *   async () => await icpService.getAllTransactions(),
 *   500
 * );
 *
 * // Call multiple times - only executes once after 500ms of quiet
 * debouncedFetch(); // Scheduled
 * debouncedFetch(); // Cancels previous, reschedules
 * debouncedFetch(); // Cancels previous, reschedules
 * // -> Executes once after 500ms
 *
 * // Cancel pending invocation
 * debouncedFetch.cancel();
 *
 * // Immediately invoke pending call
 * debouncedFetch.flush();
 * ```
 */
export function debounce<T extends AnyFunction>(
  func: T,
  wait: number,
  options: DebounceOptions = {}
): DebouncedFunction<T> {
  const {
    leading = false,
    trailing = true,
    maxWait
  } = options;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let maxTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastCallTime: number | null = null;
  let lastInvokeTime = 0;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: unknown = null;

  /**
   * Invoke the function with the last arguments
   */
  function invokeFunc(time: number) {
    const args = lastArgs!;
    const thisArg = lastThis;

    lastArgs = null;
    lastThis = null;
    lastInvokeTime = time;

    return func.apply(thisArg, args);
  }

  /**
   * Start a timer for the leading edge
   */
  function leadingEdge(time: number) {
    lastInvokeTime = time;

    // Start the timer for the trailing edge
    timeoutId = setTimeout(timerExpired, wait);

    // Invoke on leading edge if configured
    return leading ? invokeFunc(time) : undefined;
  }

  /**
   * Check if we should invoke the function
   */
  function shouldInvoke(time: number): boolean {
    const timeSinceLastCall = time - (lastCallTime || 0);
    const timeSinceLastInvoke = time - lastInvokeTime;

    // Either this is the first call, or enough time has elapsed
    return (
      lastCallTime === null ||
      timeSinceLastCall >= wait ||
      timeSinceLastCall < 0 || // Handle time drift
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    );
  }

  /**
   * Handle the trailing edge invocation
   */
  function trailingEdge(time: number) {
    timeoutId = null;

    // Only invoke if we have lastArgs (meaning there was a call during the wait period)
    if (trailing && lastArgs) {
      return invokeFunc(time);
    }

    lastArgs = null;
    lastThis = null;
    return undefined;
  }

  /**
   * Called when the timer expires
   */
  function timerExpired() {
    const time = Date.now();

    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }

    // Restart the timer for remaining wait time
    const timeSinceLastCall = time - (lastCallTime || 0);
    const timeWaiting = wait - timeSinceLastCall;
    timeoutId = setTimeout(timerExpired, timeWaiting);
  }

  /**
   * Cancel any pending invocations
   */
  function cancel() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (maxTimeoutId !== null) {
      clearTimeout(maxTimeoutId);
      maxTimeoutId = null;
    }
    lastInvokeTime = 0;
    lastArgs = null;
    lastCallTime = null;
    lastThis = null;
  }

  /**
   * Immediately invoke any pending invocation
   */
  function flush() {
    if (timeoutId === null) {
      return undefined;
    }

    const time = Date.now();
    return trailingEdge(time);
  }

  /**
   * Check if there's a pending invocation
   */
  function pending(): boolean {
    return timeoutId !== null;
  }

  /**
   * The debounced function
   */
  function debounced(this: unknown, ...args: Parameters<T>) {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    // Capturing the call-site `this` is the point: the deferred invocation
    // replays it via `.apply(thisArg, ...)` (see invokeFunc above). Not an
    // alias-to-avoid-a-closure, which is what the rule is guarding against.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      // First call or past maxWait
      if (timeoutId === null) {
        return leadingEdge(lastCallTime);
      }

      // Handle maxWait
      if (maxWait !== undefined) {
        // Start both timers
        timeoutId = setTimeout(timerExpired, wait);
        return leading ? invokeFunc(lastCallTime) : undefined;
      }
    }

    // Not invoking yet, ensure timer is running
    if (timeoutId === null) {
      timeoutId = setTimeout(timerExpired, wait);
    }

    return undefined;
  }

  debounced.cancel = cancel;
  debounced.flush = flush;
  debounced.pending = pending;

  return debounced as DebouncedFunction<T>;
}

/**
 * Creates a throttled function that only invokes func at most once per
 * every wait milliseconds.
 *
 * Useful for limiting the rate of expensive operations like API calls,
 * scroll handlers, or resize handlers.
 *
 * @param func - The function to throttle
 * @param wait - The number of milliseconds to throttle invocations to
 * @param options - Configuration options
 * @returns A throttled version of the function with cancel method
 *
 * @example
 * ```typescript
 * // Throttle scroll-triggered data fetching to once per second
 * const throttledFetch = throttle(
 *   async () => await loadMoreData(),
 *   1000
 * );
 *
 * window.addEventListener('scroll', throttledFetch);
 *
 * // Calls within 1 second are ignored
 * throttledFetch(); // Executes immediately
 * throttledFetch(); // Ignored (within 1s)
 * throttledFetch(); // Ignored (within 1s)
 * // Wait 1 second
 * throttledFetch(); // Executes
 *
 * // Cancel pending invocation
 * throttledFetch.cancel();
 * ```
 */
export function throttle<T extends AnyFunction>(
  func: T,
  wait: number,
  options: ThrottleOptions = {}
): ThrottledFunction<T> {
  const {
    leading = true,
    trailing = true
  } = options;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastInvokeTime = 0;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: unknown = null;

  /**
   * Invoke the function
   */
  function invokeFunc(time: number) {
    const args = lastArgs!;
    const thisArg = lastThis;

    lastArgs = null;
    lastThis = null;
    lastInvokeTime = time;

    return func.apply(thisArg, args);
  }

  /**
   * Check if we should invoke the function
   */
  function shouldInvoke(time: number): boolean {
    const timeSinceLastInvoke = time - lastInvokeTime;

    // First call or enough time has passed
    return lastInvokeTime === 0 || timeSinceLastInvoke >= wait;
  }

  /**
   * Handle the trailing edge
   */
  function trailingEdge() {
    timeoutId = null;

    // Only invoke if there are pending args (meaning there was a call during throttle period)
    if (trailing && lastArgs) {
      const time = Date.now();
      return invokeFunc(time);
    }

    lastArgs = null;
    lastThis = null;
    return undefined;
  }

  /**
   * Cancel any pending invocations
   */
  function cancel() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastInvokeTime = 0;
    lastArgs = null;
    lastThis = null;
  }

  /**
   * Check if there's a pending invocation
   */
  function pending(): boolean {
    return timeoutId !== null;
  }

  /**
   * The throttled function
   */
  function throttled(this: unknown, ...args: Parameters<T>) {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    // Same as in `debounced` above — the deferred call replays this `this`.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    lastThis = this;

    if (isInvoking) {
      // First call or past wait time
      if (timeoutId === null) {
        // Leading edge
        if (leading) {
          lastInvokeTime = time;
          timeoutId = setTimeout(trailingEdge, wait);
          return invokeFunc(time);
        } else {
          // No leading edge, just start timer
          lastInvokeTime = time;
          timeoutId = setTimeout(trailingEdge, wait);
        }
      }
    } else {
      // Within throttle period - update args for potential trailing call
      if (timeoutId === null) {
        timeoutId = setTimeout(trailingEdge, wait - (time - lastInvokeTime));
      }
    }

    return undefined;
  }

  throttled.cancel = cancel;
  throttled.pending = pending;

  return throttled as ThrottledFunction<T>;
}

/**
 * Create a debounced version of an async function with promise handling
 *
 * Unlike the standard debounce, this ensures that the returned promise
 * resolves/rejects with the actual function result when it eventually executes.
 *
 * @param func - The async function to debounce
 * @param wait - The number of milliseconds to delay
 * @param options - Configuration options
 * @returns A debounced async function
 *
 * @example
 * ```typescript
 * const debouncedSearch = debounceAsync(
 *   async (query: string) => await api.search(query),
 *   300
 * );
 *
 * const result = await debouncedSearch('test'); // Waits 300ms then executes
 * ```
 */
export function debounceAsync<T extends AnyAsyncFunction>(
  func: T,
  wait: number,
  options: DebounceOptions = {}
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  interface Waiter {
    resolve: (value: Awaited<ReturnType<T>>) => void;
    reject: (reason?: unknown) => void;
  }

  // Everyone who calls inside the debounce window is waiting on the SAME
  // eventual invocation, so they queue. This was a single slot that each new
  // call overwrote, which left every earlier caller's promise unsettled for
  // good — not rejected, never settled. icp.service.getAllTransactions() is
  // debounced at 500ms, so two components asking for the list on one mount
  // left one of them awaiting forever.
  let waiters: Waiter[] = [];

  // A regular function, NOT an arrow: debounce() invokes this with the `this`
  // it captured, and an arrow would bind lexically and silently drop it before
  // it ever reached `func`.
  const debouncedFunc = debounce(
    async function (this: unknown, ...args: Parameters<T>) {
      // Detach before awaiting. A caller that arrives while `func` is in
      // flight belongs to the NEXT invocation — resolving it from this one
      // would hand it a result computed before it asked.
      const settling = waiters;
      waiters = [];
      try {
        // `func` is T, so calling it with Parameters<T> yields ReturnType<T> —
        // but inside the generic body TypeScript resolves the call through the
        // CONSTRAINT (Promise<unknown>) and loses that. The assertion restates
        // what the signature already guarantees; it is not widening anything.
        const result = (await func.apply(this, args)) as Awaited<ReturnType<T>>;
        for (const waiter of settling) waiter.resolve(result);
        return result;
      } catch (error) {
        for (const waiter of settling) waiter.reject(error);
        // Deliberately NOT rethrown. Every caller has just been rejected above,
        // so a rethrow reaches nobody: this function runs from debounce()'s
        // trailing-edge timer, whose callback discards the returned promise, so
        // the rejection would float and surface as an unhandled rejection. The
        // return value is ignored by debounceAsync in any case.
      }
    },
    wait,
    options
  );

  return function (this: unknown, ...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> {
    return new Promise((resolve, reject) => {
      waiters.push({ resolve, reject });
      debouncedFunc.apply(this, args);
    });
  };
}
