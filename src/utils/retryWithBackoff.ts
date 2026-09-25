// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Retry with Exponential Backoff Utility for PropXchain
 *
 * Implements retry logic with exponential backoff specifically for handling
 * rate-limited responses from ICP canisters. Automatically detects rate limit
 * errors and retries with increasing delays.
 */

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds for first retry (default: 1000) */
  baseDelayMs?: number;
  /** Maximum delay in milliseconds between retries (default: 10000) */
  maxDelayMs?: number;
  /** Whether to add random jitter to delays (default: true) */
  jitter?: boolean;
  /** Custom function to determine if an error is retryable */
  isRetryable?: (error: any) => boolean;
  /** Optional name for debugging/logging */
  name?: string;
  /** Callback called before each retry attempt */
  onRetry?: (attempt: number, delay: number, error: any) => void;
}

/**
 * Information about a retry attempt
 */
export interface RetryAttempt {
  /** Current attempt number (0-indexed) */
  attempt: number;
  /** Delay in milliseconds before this retry */
  delayMs: number;
  /** The error that triggered this retry */
  error: any;
  /** Total attempts allowed */
  maxRetries: number;
}

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
  /** The successful result value */
  value: T;
  /** Number of attempts made (1 = succeeded on first try) */
  attempts: number;
  /** Total time spent retrying in milliseconds */
  totalTimeMs: number;
}

/**
 * Abortable retry function
 */
export interface AbortableRetry<T> {
  /** Promise that resolves with the result or rejects if all retries fail */
  promise: Promise<RetryResult<T>>;
  /** Abort the retry operation */
  abort: () => void;
  /** Check if the retry operation is aborted */
  isAborted: () => boolean;
}

/**
 * Check if an error is a rate limit error from ICP canister
 *
 * Detects various forms of rate limiting errors from ICP responses:
 * - HTTP 429 Too Many Requests
 * - Error messages containing rate limit keywords
 * - Canister rejection codes for rate limiting
 *
 * @param error - The error to check
 * @returns true if error is rate limit related, false otherwise
 */
export function isRateLimitError(error: any): boolean {
  if (!error) {
    return false;
  }

  // Check for HTTP 429 status code
  if (error.status === 429 || error.statusCode === 429) {
    return true;
  }

  // Check error message for rate limit keywords
  const errorMessage = (error.message || error.toString()).toLowerCase();
  const rateLimitKeywords = [
    'rate limit',
    'too many requests',
    'throttle',
    'quota exceeded',
    'request limit',
    'call limit'
  ];

  if (rateLimitKeywords.some(keyword => errorMessage.includes(keyword))) {
    return true;
  }

  // Check for ICP-specific rejection codes
  // IC0301: Canister is out of cycles (could be rate related)
  // IC0503: Canister rejected the message (could be rate limiting)
  if (error.code) {
    const code = error.code.toString();
    if (code === 'IC0301' || code === 'IC0503') {
      return true;
    }
  }

  return false;
}

/**
 * Check if an error is retryable (network errors, timeouts, rate limits)
 *
 * @param error - The error to check
 * @returns true if error is retryable, false otherwise
 */
export function isRetryableError(error: any): boolean {
  if (!error) {
    return false;
  }

  // Always retry rate limit errors
  if (isRateLimitError(error)) {
    return true;
  }

  // Check for network errors
  const errorMessage = (error.message || error.toString()).toLowerCase();
  const retryableKeywords = [
    'network',
    'timeout',
    'econnreset',
    'enotfound',
    'econnrefused',
    'etimedout',
    'fetch failed'
  ];

  if (retryableKeywords.some(keyword => errorMessage.includes(keyword))) {
    return true;
  }

  // Check for HTTP status codes that are retryable
  const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
  if (error.status && retryableStatusCodes.includes(error.status)) {
    return true;
  }

  return false;
}

/**
 * Calculate delay for a retry attempt using exponential backoff with optional jitter
 *
 * Formula: min(maxDelay, baseDelay * 2^attempt)
 * With jitter: delay * (0.5 + random * 0.5) for +/- 50% variation
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param baseDelayMs - Base delay in milliseconds
 * @param maxDelayMs - Maximum delay in milliseconds
 * @param jitter - Whether to add random jitter
 * @returns Calculated delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitter: boolean = true
): number {
  // Calculate exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);

  // Cap at max delay
  let delay = Math.min(maxDelayMs, exponentialDelay);

  // Add jitter (random variation of +/- 50%)
  if (jitter) {
    const jitterFactor = 0.5 + Math.random() * 0.5; // Random between 0.5 and 1.0
    delay = Math.floor(delay * jitterFactor);
  }

  return delay;
}

/**
 * Retry a function with exponential backoff
 *
 * Automatically retries failed operations with increasing delays between attempts.
 * Particularly useful for handling rate-limited canister calls.
 *
 * @param fn - Async function to retry
 * @param config - Retry configuration
 * @returns Promise that resolves with RetryResult or rejects if all retries fail
 *
 * @example
 * ```typescript
 * // Retry a canister call with default settings
 * try {
 *   const result = await retryWithBackoff(
 *     async () => await icpService.getAllTransactions()
 *   );
 *   console.log(`Succeeded after ${result.attempts} attempts`);
 * } catch (error) {
 *   console.error('All retries failed:', error);
 * }
 *
 * // Custom retry configuration
 * const result = await retryWithBackoff(
 *   async () => await icpService.createTransaction(data),
 *   {
 *     maxRetries: 5,
 *     baseDelayMs: 2000,
 *     onRetry: (attempt, delay, error) => {
 *       console.log(`Retry ${attempt + 1} after ${delay}ms due to:`, error.message);
 *     }
 *   }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    jitter = true,
    isRetryable = isRetryableError,
    onRetry
  } = config;

  const startTime = Date.now();
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const value = await fn();
      const totalTimeMs = Date.now() - startTime;

      return {
        value,
        attempts: attempt + 1,
        totalTimeMs
      };
    } catch (error) {
      lastError = error;

      // Don't retry if this is the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Check if error is retryable
      if (!isRetryable(error)) {
        throw error; // Non-retryable error, fail immediately
      }

      // Calculate delay for this retry
      const delayMs = calculateBackoffDelay(attempt, baseDelayMs, maxDelayMs, jitter);

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(attempt, delayMs, error);
      }

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  // All retries exhausted
  throw lastError;
}

/**
 * Create an abortable retry operation
 *
 * Returns an object with a promise and abort function, allowing
 * cancellation of pending retries.
 *
 * @param fn - Async function to retry
 * @param config - Retry configuration
 * @returns AbortableRetry object with promise and abort method
 *
 * @example
 * ```typescript
 * const retry = retryWithBackoffAbortable(
 *   async () => await fetchData()
 * );
 *
 * // Abort after 5 seconds
 * setTimeout(() => {
 *   retry.abort();
 * }, 5000);
 *
 * try {
 *   const result = await retry.promise;
 *   console.log('Success:', result);
 * } catch (error) {
 *   if (retry.isAborted()) {
 *     console.log('Operation was aborted');
 *   } else {
 *     console.error('Operation failed:', error);
 *   }
 * }
 * ```
 */
export function retryWithBackoffAbortable<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): AbortableRetry<T> {
  let aborted = false;
  const abortController = new AbortController();

  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    jitter = true,
    isRetryable = isRetryableError,
    onRetry
  } = config;

  const promise = (async (): Promise<RetryResult<T>> => {
    const startTime = Date.now();
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Check if aborted
      if (aborted) {
        throw new Error('Retry operation aborted');
      }

      try {
        const value = await fn();
        const totalTimeMs = Date.now() - startTime;

        return {
          value,
          attempts: attempt + 1,
          totalTimeMs
        };
      } catch (error) {
        lastError = error;

        // Don't retry if aborted
        if (aborted) {
          throw new Error('Retry operation aborted');
        }

        // Don't retry if this is the last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Check if error is retryable
        if (!isRetryable(error)) {
          throw error; // Non-retryable error, fail immediately
        }

        // Calculate delay for this retry
        const delayMs = calculateBackoffDelay(attempt, baseDelayMs, maxDelayMs, jitter);

        // Call onRetry callback if provided
        if (onRetry) {
          onRetry(attempt, delayMs, error);
        }

        // Wait before retrying (with abort support)
        await sleepAbortable(delayMs, abortController.signal);
      }
    }

    // All retries exhausted
    throw lastError;
  })();

  return {
    promise,
    abort: () => {
      aborted = true;
      abortController.abort();
    },
    isAborted: () => aborted
  };
}

/**
 * Sleep for a specified duration
 *
 * @param ms - Duration in milliseconds
 * @returns Promise that resolves after the delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sleep for a specified duration with abort support
 *
 * @param ms - Duration in milliseconds
 * @param signal - AbortSignal to cancel the sleep
 * @returns Promise that resolves after the delay or rejects if aborted
 */
function sleepAbortable(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('Sleep aborted'));
      return;
    }

    const timeout = setTimeout(resolve, ms);

    const abortHandler = () => {
      clearTimeout(timeout);
      reject(new Error('Sleep aborted'));
    };

    signal.addEventListener('abort', abortHandler, { once: true });
  });
}

/**
 * Create a retry function with default PropXchain configuration
 * Default: max 3 retries, 1-10 second exponential backoff with jitter
 */
export function createDefaultRetry<T>(
  fn: () => Promise<T>,
  customConfig?: Partial<RetryConfig>
): Promise<RetryResult<T>> {
  return retryWithBackoff(fn, {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    jitter: true,
    name: 'default-retry',
    ...customConfig
  });
}

/**
 * Create a retry function optimized for rate limit errors
 * More retries with longer delays to give rate limits time to reset
 */
export function createRateLimitRetry<T>(
  fn: () => Promise<T>,
  customConfig?: Partial<RetryConfig>
): Promise<RetryResult<T>> {
  return retryWithBackoff(fn, {
    maxRetries: 5,
    baseDelayMs: 2000,
    maxDelayMs: 30000,
    jitter: true,
    isRetryable: isRateLimitError, // Only retry on rate limit errors
    name: 'rate-limit-retry',
    ...customConfig
  });
}

/**
 * Create a retry function for quick network retries
 * Fast retries with low delay for transient network issues
 */
export function createQuickRetry<T>(
  fn: () => Promise<T>,
  customConfig?: Partial<RetryConfig>
): Promise<RetryResult<T>> {
  return retryWithBackoff(fn, {
    maxRetries: 2,
    baseDelayMs: 500,
    maxDelayMs: 2000,
    jitter: true,
    name: 'quick-retry',
    ...customConfig
  });
}
