// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Canister Rate Limiter Service for PropXchain
 *
 * Central service for wrapping ICP canister calls with rate limiting,
 * debouncing, retry logic, and request deduplication. Prevents excessive
 * calls that could waste cycles or trigger service disruptions.
 */

import { CategoryRateLimiter } from '../utils/rateLimiter';
import { RequestQueue, RequestPriority } from '../utils/requestQueue';
import { retryWithBackoff, RetryConfig, isRateLimitError } from '../utils/retryWithBackoff';

/**
 * Operation type for categorizing canister calls
 */
export type OperationType = 'read' | 'write';

/**
 * Configuration for a canister call
 */
export interface CanisterCallConfig {
  /** Operation type (read or write) - affects rate limits */
  operationType: OperationType;
  /** Priority level for queuing */
  priority?: RequestPriority;
  /** Custom retry configuration */
  retryConfig?: Partial<RetryConfig>;
  /** Whether to enable request deduplication (default: true) */
  deduplicate?: boolean;
  /** Cache key for deduplication (auto-generated if not provided) */
  cacheKey?: string;
  /** Whether to log this operation (default: true) */
  enableLogging?: boolean;
}

/**
 * Rate limit event types for logging
 */
export enum RateLimitEvent {
  RATE_LIMITED = 'RATE_LIMITED',
  QUEUED = 'QUEUED',
  RETRY_ATTEMPT = 'RETRY_ATTEMPT',
  DEDUPLICATION_HIT = 'DEDUPLICATION_HIT',
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE'
}

/**
 * Rate limit event data for logging
 */
export interface RateLimitEventData {
  event: RateLimitEvent;
  operationType: OperationType;
  timestamp: number;
  details?: any;
}

/**
 * Event listener callback type
 */
export type EventListener = (data: RateLimitEventData) => void;

/**
 * Statistics for monitoring
 */
export interface CanisterCallStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  rateLimitedCalls: number;
  queuedCalls: number;
  deduplicationHits: number;
  averageRetries: number;
}

/**
 * Canister Rate Limiter Service
 *
 * Singleton service that wraps canister calls with comprehensive protection:
 * - Rate limiting using token bucket algorithm
 * - Request queuing with priority support
 * - Automatic retry with exponential backoff
 * - Request deduplication for identical concurrent calls
 * - Event logging for debugging and monitoring
 *
 * @example
 * ```typescript
 * // Get singleton instance
 * const rateLimiter = CanisterRateLimiter.getInstance();
 *
 * // Wrap a read operation
 * const transactions = await rateLimiter.call(
 *   async () => await icpService.getAllTransactions(),
 *   { operationType: 'read' }
 * );
 *
 * // Wrap a write operation with high priority
 * const result = await rateLimiter.call(
 *   async () => await icpService.createTransaction(data),
 *   {
 *     operationType: 'write',
 *     priority: RequestPriority.HIGH
 *   }
 * );
 *
 * // Listen for rate limit events
 * rateLimiter.addEventListener((event) => {
 *   console.log('Rate limit event:', event);
 * });
 * ```
 */
export class CanisterRateLimiter {
  private static instance: CanisterRateLimiter | null = null;

  private rateLimiter: CategoryRateLimiter;
  private requestQueue: RequestQueue;
  private inFlightRequests: Map<string, Promise<any>>;
  private eventListeners: Set<EventListener>;
  private stats: CanisterCallStats;

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    // Initialize rate limiter with default configuration
    // Read: 60 requests/min with burst of 10
    // Write: 10 requests/min with burst of 3
    this.rateLimiter = new CategoryRateLimiter({
      read: {
        maxTokens: 10,
        refillRate: 1, // 60 per minute = 1 per second
        name: 'read-operations'
      },
      write: {
        maxTokens: 3,
        refillRate: 0.167, // 10 per minute = 0.167 per second
        name: 'write-operations'
      }
    });

    // Initialize request queue with max 5 concurrent requests
    this.requestQueue = new RequestQueue({
      maxConcurrent: 5,
      name: 'canister-queue'
    });

    // Initialize deduplication cache
    this.inFlightRequests = new Map();

    // Initialize event listeners
    this.eventListeners = new Set();

    // Initialize statistics
    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rateLimitedCalls: 0,
      queuedCalls: 0,
      deduplicationHits: 0,
      averageRetries: 0
    };
  }

  /**
   * Get the singleton instance
   * @returns The CanisterRateLimiter instance
   */
  static getInstance(): CanisterRateLimiter {
    if (!CanisterRateLimiter.instance) {
      CanisterRateLimiter.instance = new CanisterRateLimiter();
    }
    return CanisterRateLimiter.instance;
  }

  /**
   * Execute a canister call with rate limiting, queuing, and retry logic
   *
   * @param fn - Async function that makes the canister call
   * @param config - Configuration for this call
   * @returns Promise that resolves with the function result
   *
   * @example
   * ```typescript
   * const data = await rateLimiter.call(
   *   async () => await canister.myMethod(),
   *   { operationType: 'read' }
   * );
   * ```
   */
  async call<T>(
    fn: () => Promise<T>,
    config: CanisterCallConfig
  ): Promise<T> {
    const {
      operationType,
      priority = RequestPriority.NORMAL,
      retryConfig = {},
      deduplicate = true,
      cacheKey,
      enableLogging = true
    } = config;

    this.stats.totalCalls++;

    // Generate or use provided cache key for deduplication
    const requestKey = cacheKey || this.generateCacheKey(fn, config);

    // Check for in-flight duplicate request
    if (deduplicate && this.inFlightRequests.has(requestKey)) {
      this.stats.deduplicationHits++;
      this.emitEvent({
        event: RateLimitEvent.DEDUPLICATION_HIT,
        operationType,
        timestamp: Date.now(),
        details: { cacheKey: requestKey }
      }, enableLogging);

      return this.inFlightRequests.get(requestKey)!;
    }

    // Create the wrapped call with all protections
    const wrappedCall = async (): Promise<T> => {
      try {
        // Check rate limit
        if (!this.rateLimiter.acquire(operationType)) {
          this.stats.rateLimitedCalls++;
          const status = this.rateLimiter.getStatus(operationType);

          this.emitEvent({
            event: RateLimitEvent.RATE_LIMITED,
            operationType,
            timestamp: Date.now(),
            details: {
              availableTokens: status?.availableTokens,
              timeUntilNextToken: status?.timeUntilNextToken
            }
          }, enableLogging);

          // Wait for token to become available
          const waitTime = status?.timeUntilNextToken || 1000;
          await this.sleep(waitTime);

          // Try to acquire again after waiting
          if (!this.rateLimiter.acquire(operationType)) {
            throw new Error(
              'Request rate limit exceeded. Please wait before retrying.'
            );
          }
        }

        // Execute with retry logic
        const result = await retryWithBackoff(fn, {
          maxRetries: 3,
          baseDelayMs: 1000,
          maxDelayMs: 10000,
          jitter: true,
          onRetry: (attempt, delay, error) => {
            this.emitEvent({
              event: RateLimitEvent.RETRY_ATTEMPT,
              operationType,
              timestamp: Date.now(),
              details: {
                attempt: attempt + 1,
                delay,
                error: error.message,
                isRateLimitError: isRateLimitError(error)
              }
            }, enableLogging);
          },
          ...retryConfig
        });

        this.stats.successfulCalls++;
        this.stats.averageRetries = this.calculateAverageRetries(result.attempts);

        this.emitEvent({
          event: RateLimitEvent.SUCCESS,
          operationType,
          timestamp: Date.now(),
          details: {
            attempts: result.attempts,
            totalTimeMs: result.totalTimeMs
          }
        }, enableLogging);

        return result.value;
      } catch (error) {
        this.stats.failedCalls++;

        this.emitEvent({
          event: RateLimitEvent.FAILURE,
          operationType,
          timestamp: Date.now(),
          details: {
            error: error instanceof Error ? error.message : String(error)
          }
        }, enableLogging);

        throw error;
      }
    };

    // Enqueue the call with priority
    const queuedPromise = this.requestQueue.enqueue(wrappedCall, priority);

    // Track queue event
    if (this.requestQueue.getQueueLength() > 0) {
      this.stats.queuedCalls++;
      this.emitEvent({
        event: RateLimitEvent.QUEUED,
        operationType,
        timestamp: Date.now(),
        details: {
          queueLength: this.requestQueue.getQueueLength(),
          priority
        }
      }, enableLogging);
    }

    // Store in deduplication cache if enabled
    if (deduplicate) {
      // Wrap in a new promise so each caller gets independent rejection handling.
      // Without this, concurrent callers sharing a rejected promise get unhandled rejections.
      const sharedPromise = queuedPromise.then(
        (value) => value,
        (error) => {
          // Remove from cache immediately on failure so next caller retries fresh
          this.inFlightRequests.delete(requestKey);
          throw error;
        }
      );

      this.inFlightRequests.set(requestKey, sharedPromise);

      // `sharedPromise` is only ever awaited by a *duplicate* caller — the
      // originating caller gets `queuedPromise` below. If no duplicate arrives
      // before it settles, a rejection here has no handler and surfaces as an
      // unhandled rejection (it fires window.onunhandledrejection in the app,
      // and fails the vitest run even with every test passing). Attaching a
      // terminal no-op handler swallows nothing: `.catch()` returns a new
      // promise, so a dedup hit awaiting `sharedPromise` still gets the error.
      sharedPromise.catch(() => {});

      // Clean up cache when promise settles successfully
      queuedPromise
        .then(() => {
          this.inFlightRequests.delete(requestKey);
        })
        .catch(() => {
          // Error cleanup handled above in sharedPromise
        });
    }

    return queuedPromise;
  }

  /**
   * Add an event listener for rate limit events
   *
   * @param listener - Callback function for events
   *
   * @example
   * ```typescript
   * rateLimiter.addEventListener((event) => {
   *   if (event.event === RateLimitEvent.RATE_LIMITED) {
   *     console.warn('Rate limited:', event);
   *   }
   * });
   * ```
   */
  addEventListener(listener: EventListener): void {
    this.eventListeners.add(listener);
  }

  /**
   * Remove an event listener
   *
   * @param listener - Callback function to remove
   */
  removeEventListener(listener: EventListener): void {
    this.eventListeners.delete(listener);
  }

  /**
   * Get current statistics
   *
   * @returns Current call statistics
   */
  getStats(): CanisterCallStats {
    return { ...this.stats };
  }

  /**
   * Get rate limit status for an operation type
   *
   * @param operationType - The operation type to check
   * @returns Rate limit status information
   */
  getRateLimitStatus(operationType: OperationType) {
    return this.rateLimiter.getStatus(operationType);
  }

  /**
   * Get request queue status
   *
   * @returns Queue status information
   */
  getQueueStatus() {
    return this.requestQueue.getStatus();
  }

  /**
   * Reset rate limiters (testing only — disabled in production)
   */
  resetRateLimits(): void {
    if (import.meta.env.PROD) {
      throw new Error('Rate limiter reset not allowed in production');
    }
    this.rateLimiter.resetAll();
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rateLimitedCalls: 0,
      queuedCalls: 0,
      deduplicationHits: 0,
      averageRetries: 0
    };
  }

  /**
   * Flush the request queue
   * Cancels all pending requests
   *
   * @returns Number of requests that were flushed
   */
  flush(): number {
    return this.requestQueue.flush();
  }

  /**
   * Generate a cache key for request deduplication
   * @private
   */
  private generateCacheKey(fn: () => Promise<unknown>, config: CanisterCallConfig): string {
    // Use function name and operation type as base key
    const fnName = fn.name || 'anonymous';
    const opType = config.operationType;

    // Create a simple hash of the function string (for anonymous functions)
    const fnString = fn.toString();
    const hash = this.simpleHash(fnString);

    return `${opType}-${fnName}-${hash}`;
  }

  /**
   * Simple string hash function
   * @private
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Emit a rate limit event to all listeners
   * @private
   */
  private emitEvent(data: RateLimitEventData, enableLogging: boolean): void {
    if (enableLogging) {
      this.eventListeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          // Ignore listener errors
        }
      });
    }
  }

  /**
   * Calculate running average of retries
   * @private
   */
  private calculateAverageRetries(newAttempts: number): number {
    const totalCalls = this.stats.successfulCalls + 1;
    const currentTotal = this.stats.averageRetries * this.stats.successfulCalls;
    return (currentTotal + newAttempts) / totalCalls;
  }

  /**
   * Sleep utility
   * @private
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Get the singleton CanisterRateLimiter instance
 * Convenience function for easier imports
 *
 * @returns The CanisterRateLimiter instance
 */
export function getCanisterRateLimiter(): CanisterRateLimiter {
  return CanisterRateLimiter.getInstance();
}

/**
 * Helper function to wrap a canister read operation
 *
 * @param fn - Async function that makes the canister call
 * @param config - Optional additional configuration
 * @returns Promise that resolves with the function result
 *
 * @example
 * ```typescript
 * const transactions = await wrapReadCall(
 *   async () => await icpService.getAllTransactions()
 * );
 * ```
 */
export async function wrapReadCall<T>(
  fn: () => Promise<T>,
  config?: Partial<CanisterCallConfig>
): Promise<T> {
  const rateLimiter = getCanisterRateLimiter();
  return rateLimiter.call(fn, {
    operationType: 'read',
    ...config
  });
}

/**
 * Helper function to wrap a canister write operation
 *
 * @param fn - Async function that makes the canister call
 * @param config - Optional additional configuration
 * @returns Promise that resolves with the function result
 *
 * @example
 * ```typescript
 * const result = await wrapWriteCall(
 *   async () => await icpService.createTransaction(data),
 *   { priority: RequestPriority.HIGH }
 * );
 * ```
 */
export async function wrapWriteCall<T>(
  fn: () => Promise<T>,
  config?: Partial<CanisterCallConfig>
): Promise<T> {
  const rateLimiter = getCanisterRateLimiter();
  return rateLimiter.call(fn, {
    operationType: 'write',
    priority: RequestPriority.NORMAL,
    ...config
  });
}

/**
 * Create a rate-limited version of a canister method
 *
 * @param fn - The canister method to wrap
 * @param config - Configuration for all calls to this method
 * @returns A wrapped version of the function with rate limiting
 *
 * @example
 * ```typescript
 * const rateLimitedGetTransactions = createRateLimitedMethod(
 *   icpService.getAllTransactions.bind(icpService),
 *   { operationType: 'read' }
 * );
 *
 * // Use like a normal async function
 * const transactions = await rateLimitedGetTransactions();
 * ```
 */
export function createRateLimitedMethod<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  config: CanisterCallConfig
): T {
  const rateLimiter = getCanisterRateLimiter();

  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return rateLimiter.call(
      () => fn(...args),
      config
    );
  }) as T;
}

// Export singleton instance as default
export default CanisterRateLimiter.getInstance();
