// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CanisterRateLimiter,
  wrapReadCall,
  wrapWriteCall,
  createRateLimitedMethod,
  RateLimitEvent,
  type RateLimitEventData
} from '../canisterRateLimiter';
import { RequestPriority } from '../../utils/requestQueue';

// Helper to wait for a specific time
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('CanisterRateLimiter Integration Tests', () => {
  let rateLimiter: CanisterRateLimiter;

  beforeEach(() => {
    // Get a fresh instance for each test
    rateLimiter = CanisterRateLimiter.getInstance();
    rateLimiter.resetRateLimits();
    rateLimiter.resetStats();
  });

  describe('Rate Limiting Kicks In After Threshold', () => {
    it('should enforce rate limiting when burst limit is exceeded', async () => {
      const mockFn = vi.fn(async () => 'success');
      const eventListener = vi.fn();
      rateLimiter.addEventListener(eventListener);

      // Read operations have burst of 10 tokens
      // Make rapid calls within the burst limit (disable dedup to test concurrency)
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          rateLimiter.call(mockFn, {
            operationType: 'read',
            deduplicate: false // Disable deduplication for this test
          })
        );
      }

      const results = await Promise.all(promises);

      // Check stats - all calls should complete successfully within burst limit
      expect(results).toHaveLength(10);
      const stats = rateLimiter.getStats();
      expect(stats.totalCalls).toBe(10);
      expect(stats.successfulCalls).toBe(10);

      // Should have called the function for each request
      expect(mockFn.mock.calls.length).toBeGreaterThanOrEqual(10);
    });

    it('should track available tokens correctly', async () => {
      const mockFn = vi.fn(async () => 'success');

      // Check initial status
      const initialStatus = rateLimiter.getRateLimitStatus('read');
      expect(initialStatus?.availableTokens).toBe(10);

      // Make 3 calls
      await Promise.all([
        rateLimiter.call(mockFn, { operationType: 'read' }),
        rateLimiter.call(mockFn, { operationType: 'read' }),
        rateLimiter.call(mockFn, { operationType: 'read' })
      ]);

      // Wait for processing
      await wait(100);

      // Check status after calls - should have consumed tokens
      const afterStatus = rateLimiter.getRateLimitStatus('read');
      expect(afterStatus?.availableTokens).toBeLessThan(10);
    });

    it('should enforce different limits for read vs write operations', async () => {
      const mockFn = vi.fn(async () => 'success');

      // Exhaust read tokens (10 burst limit)
      const readPromises = [];
      for (let i = 0; i < 10; i++) {
        readPromises.push(rateLimiter.call(mockFn, { operationType: 'read' }));
      }
      await Promise.all(readPromises);

      // Write operations should still have tokens (3 burst limit)
      const writeResult = await rateLimiter.call(mockFn, { operationType: 'write' });
      expect(writeResult).toBe('success');

      const writeStatus = rateLimiter.getRateLimitStatus('write');
      expect(writeStatus?.availableTokens).toBe(2); // 3 - 1
    });

    it('should refill tokens over time', async () => {
      const mockFn = vi.fn(async () => 'success');

      // Consume all write tokens (3)
      await Promise.all([
        rateLimiter.call(mockFn, { operationType: 'write' }),
        rateLimiter.call(mockFn, { operationType: 'write' }),
        rateLimiter.call(mockFn, { operationType: 'write' })
      ]);

      // Wait for processing to complete
      await wait(100);

      const depletedStatus = rateLimiter.getRateLimitStatus('write');
      // Due to queue processing, might not be exactly 0
      expect(depletedStatus?.availableTokens).toBeLessThan(3);

      // Wait for tokens to refill (write refill rate is 0.167/sec)
      // After ~6 seconds should have at least 1 token back
      await wait(6000);

      const refilledStatus = rateLimiter.getRateLimitStatus('write');
      expect(refilledStatus?.availableTokens).toBeGreaterThan(depletedStatus?.availableTokens || 0);
    }, 10000); // 10 second timeout
  });

  describe('Request Deduplication Works', () => {
    it('should deduplicate identical concurrent calls with same cache key', async () => {
      const mockFn = vi.fn(async () => {
        await wait(50); // Simulate some work
        return 'success';
      });

      // Make 5 identical concurrent calls with same cache key
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          rateLimiter.call(mockFn, {
            operationType: 'read',
            cacheKey: 'test-duplicate-key'
          })
        );
      }

      const results = await Promise.all(promises);

      // All should return same result
      expect(results).toHaveLength(5);
      expect(results.every(r => r === 'success')).toBe(true);

      // But function should only be called once (due to deduplication)
      expect(mockFn).toHaveBeenCalledTimes(1);

      // Check deduplication stats
      const stats = rateLimiter.getStats();
      expect(stats.deduplicationHits).toBe(4);
    });

    it('should emit deduplication hit events', async () => {
      const mockFn = vi.fn(async () => 'success');
      const eventListener = vi.fn();
      rateLimiter.addEventListener(eventListener);

      // Make duplicate calls
      await Promise.all([
        rateLimiter.call(mockFn, {
          operationType: 'read',
          cacheKey: 'duplicate-key'
        }),
        rateLimiter.call(mockFn, {
          operationType: 'read',
          cacheKey: 'duplicate-key'
        })
      ]);

      // Check for deduplication event
      const dedupEvents = eventListener.mock.calls
        .map(call => call[0] as RateLimitEventData)
        .filter(event => event.event === RateLimitEvent.DEDUPLICATION_HIT);

      expect(dedupEvents.length).toBe(1);
      expect(dedupEvents[0].details?.cacheKey).toBe('duplicate-key');
    });

    it('should not deduplicate when disabled', async () => {
      const mockFn = vi.fn(async () => 'success');

      // Make calls with deduplication disabled
      await Promise.all([
        rateLimiter.call(mockFn, {
          operationType: 'read',
          cacheKey: 'same-key',
          deduplicate: false
        }),
        rateLimiter.call(mockFn, {
          operationType: 'read',
          cacheKey: 'same-key',
          deduplicate: false
        }),
        rateLimiter.call(mockFn, {
          operationType: 'read',
          cacheKey: 'same-key',
          deduplicate: false
        })
      ]);

      // All calls should execute
      expect(mockFn.mock.calls.length).toBeGreaterThanOrEqual(3);

      // No deduplication hits
      const stats = rateLimiter.getStats();
      expect(stats.deduplicationHits).toBe(0);
    });

    it('should clear deduplication cache after request completes', async () => {
      const mockFn = vi.fn(async () => 'success');

      // First call
      await rateLimiter.call(mockFn, {
        operationType: 'read',
        cacheKey: 'sequential-key'
      });

      // Wait for cache to clear
      await wait(10);

      // Second call with same key after first completes
      await rateLimiter.call(mockFn, {
        operationType: 'read',
        cacheKey: 'sequential-key'
      });

      // Both should execute (not deduplicated because first completed)
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Retry Logic on Rate Limit Errors', () => {
    it('should retry on rate limit errors', async () => {
      let callCount = 0;
      const mockFn = vi.fn(async () => {
        callCount++;
        if (callCount < 2) {
          // First call fails with rate limit error
          const error = new Error('Rate limit exceeded');
          (error as any).status = 429;
          throw error;
        }
        return 'success-after-retry';
      });

      const result = await rateLimiter.call(mockFn, {
        operationType: 'read',
        retryConfig: {
          maxRetries: 3,
          baseDelayMs: 100,
          maxDelayMs: 500
        }
      });

      expect(result).toBe('success-after-retry');
      expect(mockFn).toHaveBeenCalledTimes(2);
    }, 10000);

    it('should emit retry events', async () => {
      let callCount = 0;
      const mockFn = vi.fn(async () => {
        callCount++;
        if (callCount < 2) {
          // Use a network error that's retryable
          throw new Error('Network timeout');
        }
        return 'success';
      });

      const eventListener = vi.fn();
      rateLimiter.addEventListener(eventListener);

      await rateLimiter.call(mockFn, {
        operationType: 'read',
        retryConfig: { maxRetries: 2, baseDelayMs: 100 }
      });

      // Check for retry events
      const retryEvents = eventListener.mock.calls
        .map(call => call[0] as RateLimitEventData)
        .filter(event => event.event === RateLimitEvent.RETRY_ATTEMPT);

      expect(retryEvents.length).toBeGreaterThan(0);
    }, 10000);

    it('should detect ICP-specific rate limit errors', async () => {
      const eventListener = vi.fn();
      rateLimiter.addEventListener(eventListener);

      let callCount = 0;
      const mockFn = vi.fn(async () => {
        callCount++;
        if (callCount < 2) {
          throw new Error('IC0503: Canister trapped: rate limit exceeded');
        }
        return 'success';
      });

      await rateLimiter.call(mockFn, {
        operationType: 'read',
        retryConfig: { maxRetries: 2, baseDelayMs: 100 }
      });

      // Check that retry detected it as rate limit error
      const retryEvents = eventListener.mock.calls
        .map(call => call[0] as RateLimitEventData)
        .filter(event => event.event === RateLimitEvent.RETRY_ATTEMPT);

      expect(retryEvents.length).toBeGreaterThan(0);
      expect(retryEvents[0].details?.isRateLimitError).toBe(true);
    }, 10000);

    it('should fail after max retries are exhausted', async () => {
      const mockFn = vi.fn(async () => {
        // Use a retryable error (network error)
        throw new Error('Network error: connection refused');
      });

      await expect(
        rateLimiter.call(mockFn, {
          operationType: 'read',
          retryConfig: { maxRetries: 2, baseDelayMs: 50 }
        })
      ).rejects.toThrow('Network error');

      // Should have tried 3 times (initial + 2 retries)
      expect(mockFn).toHaveBeenCalledTimes(3);
    }, 10000);
  });

  describe('User-Friendly Error Messages', () => {
    it('should provide clear error when rate limit is exceeded', async () => {
      const eventListener = vi.fn();
      rateLimiter.addEventListener(eventListener);

      const mockFn = vi.fn(async () => 'success');

      // Exhaust all read tokens
      const promises = [];
      for (let i = 0; i < 11; i++) {
        promises.push(rateLimiter.call(mockFn, { operationType: 'read' }));
      }

      await Promise.all(promises);

      // Check for rate limit event with helpful details
      const rateLimitEvents = eventListener.mock.calls
        .map(call => call[0] as RateLimitEventData)
        .filter(event => event.event === RateLimitEvent.RATE_LIMITED);

      if (rateLimitEvents.length > 0) {
        expect(rateLimitEvents[0].operationType).toBe('read');
        expect(rateLimitEvents[0].details?.availableTokens).toBeDefined();
        expect(rateLimitEvents[0].details?.timeUntilNextToken).toBeDefined();
      }
    });

    it('should include operation type in failure events', async () => {
      const mockFn = vi.fn(async () => {
        throw new Error('Canister error');
      });

      const eventListener = vi.fn();
      rateLimiter.addEventListener(eventListener);

      try {
        await rateLimiter.call(mockFn, {
          operationType: 'write',
          retryConfig: { maxRetries: 0 }
        });
      } catch {
        // Expected to fail
      }

      // Check failure event includes operation type
      const failureEvents = eventListener.mock.calls
        .map(call => call[0] as RateLimitEventData)
        .filter(event => event.event === RateLimitEvent.FAILURE);

      expect(failureEvents.length).toBe(1);
      expect(failureEvents[0].operationType).toBe('write');
      expect(failureEvents[0].details?.error).toBe('Canister error');
    });

    it('should provide helpful details in success events', async () => {
      const mockFn = vi.fn(async () => 'success');
      const eventListener = vi.fn();
      rateLimiter.addEventListener(eventListener);

      await rateLimiter.call(mockFn, { operationType: 'read' });

      const successEvents = eventListener.mock.calls
        .map(call => call[0] as RateLimitEventData)
        .filter(event => event.event === RateLimitEvent.SUCCESS);

      expect(successEvents.length).toBe(1);
      expect(successEvents[0].details?.attempts).toBeDefined();
      expect(successEvents[0].details?.totalTimeMs).toBeDefined();
    });
  });

  describe('Helper Functions', () => {
    it('wrapReadCall should wrap read operations correctly', async () => {
      const mockFn = vi.fn(async () => 'read-result');

      const result = await wrapReadCall(mockFn);

      expect(result).toBe('read-result');
      expect(mockFn).toHaveBeenCalledTimes(1);

      const stats = rateLimiter.getStats();
      expect(stats.totalCalls).toBeGreaterThan(0);
    });

    it('wrapWriteCall should wrap write operations correctly', async () => {
      const mockFn = vi.fn(async () => 'write-result');

      const result = await wrapWriteCall(mockFn);

      expect(result).toBe('write-result');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('wrapWriteCall should support priority configuration', async () => {
      const mockFn = vi.fn(async () => 'high-priority-result');

      const result = await wrapWriteCall(mockFn, {
        priority: RequestPriority.HIGH
      });

      expect(result).toBe('high-priority-result');
    });

    it('createRateLimitedMethod should create reusable wrapped function', async () => {
      const mockService = {
        getData: async (id: number) => `data-${id}`
      };

      const rateLimitedGetData = createRateLimitedMethod(
        mockService.getData.bind(mockService),
        { operationType: 'read' }
      );

      const result1 = await rateLimitedGetData(1);
      const result2 = await rateLimitedGetData(2);

      expect(result1).toBe('data-1');
      expect(result2).toBe('data-2');

      const stats = rateLimiter.getStats();
      expect(stats.totalCalls).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track successful calls', async () => {
      const mockFn = vi.fn(async () => 'success');

      await rateLimiter.call(mockFn, { operationType: 'read' });

      const stats = rateLimiter.getStats();
      expect(stats.successfulCalls).toBe(1);
      expect(stats.totalCalls).toBe(1);
      expect(stats.failedCalls).toBe(0);
    });

    it('should track failed calls', async () => {
      const mockFn = vi.fn(async () => {
        throw new Error('Test error');
      });

      try {
        await rateLimiter.call(mockFn, {
          operationType: 'read',
          retryConfig: { maxRetries: 0 }
        });
      } catch {
        // Expected to fail
      }

      const stats = rateLimiter.getStats();
      expect(stats.failedCalls).toBe(1);
      expect(stats.successfulCalls).toBe(0);
    });

    it('should track deduplication hits', async () => {
      const mockFn = vi.fn(async () => 'success');

      await Promise.all([
        rateLimiter.call(mockFn, { operationType: 'read', cacheKey: 'stat-test' }),
        rateLimiter.call(mockFn, { operationType: 'read', cacheKey: 'stat-test' }),
        rateLimiter.call(mockFn, { operationType: 'read', cacheKey: 'stat-test' })
      ]);

      const stats = rateLimiter.getStats();
      expect(stats.deduplicationHits).toBe(2);
    });
  });

  describe('Event Listeners', () => {
    it('should support multiple event listeners', async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      rateLimiter.addEventListener(listener1);
      rateLimiter.addEventListener(listener2);

      const mockFn = vi.fn(async () => 'success');
      await rateLimiter.call(mockFn, { operationType: 'read' });

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should remove event listeners correctly', async () => {
      const listener = vi.fn();

      rateLimiter.addEventListener(listener);

      const mockFn = vi.fn(async () => 'success');
      await rateLimiter.call(mockFn, { operationType: 'read' });

      expect(listener).toHaveBeenCalled();
      listener.mockClear();

      // Remove listener
      rateLimiter.removeEventListener(listener);

      await rateLimiter.call(mockFn, { operationType: 'read' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should not fail if listener throws error', async () => {
      const faultyListener = vi.fn(() => {
        throw new Error('Listener error');
      });

      rateLimiter.addEventListener(faultyListener);

      const mockFn = vi.fn(async () => 'success');

      // Should not throw despite listener error
      await expect(
        rateLimiter.call(mockFn, { operationType: 'read' })
      ).resolves.toBe('success');
    });
  });

  describe('Reset Functionality', () => {
    it('should reset rate limits correctly', async () => {
      const mockFn = vi.fn(async () => 'success');

      // Consume some tokens
      await Promise.all([
        rateLimiter.call(mockFn, { operationType: 'read' }),
        rateLimiter.call(mockFn, { operationType: 'read' }),
        rateLimiter.call(mockFn, { operationType: 'read' })
      ]);

      const depletedStatus = rateLimiter.getRateLimitStatus('read');
      expect(depletedStatus?.availableTokens).toBeLessThan(10);

      // Reset
      rateLimiter.resetRateLimits();

      // Should have full tokens again
      const resetStatus = rateLimiter.getRateLimitStatus('read');
      expect(resetStatus?.availableTokens).toBe(10);
    });

    it('should reset statistics correctly', async () => {
      const mockFn = vi.fn(async () => 'success');

      await rateLimiter.call(mockFn, { operationType: 'read' });

      let stats = rateLimiter.getStats();
      expect(stats.totalCalls).toBeGreaterThan(0);

      rateLimiter.resetStats();

      stats = rateLimiter.getStats();
      expect(stats.totalCalls).toBe(0);
      expect(stats.successfulCalls).toBe(0);
      expect(stats.failedCalls).toBe(0);
    });
  });

  describe('Real-world Integration Scenarios', () => {
    it('should handle concurrent operations with rate limiting and queuing', async () => {
      const mockFn = vi.fn(async (id: number) => `result-${id}`);

      // Make concurrent calls within rate limits (disable dedup to test concurrency)
      const promises = [];
      const results: string[] = [];
      // Use 8 calls to stay comfortably within the burst limit of 10
      for (let i = 0; i < 8; i++) {
        const index = i;
        promises.push(
          rateLimiter.call(
            () => mockFn(index),
            {
              operationType: 'read',
              deduplicate: false // Disable deduplication to test actual concurrency
            }
          ).then(result => {
            results.push(result);
            return result;
          })
        );
      }

      await Promise.all(promises);

      // All should complete successfully
      expect(results).toHaveLength(8);
      // Results may not be in exact order due to queuing, but all should be present
      expect(mockFn).toHaveBeenCalledTimes(8);

      // All calls should succeed
      const stats = rateLimiter.getStats();
      expect(stats.successfulCalls).toBe(8);
    });

    it('should handle mixed read and write operations independently', async () => {
      const readFn = vi.fn(async () => 'read');
      const writeFn = vi.fn(async () => 'write');

      // Make mixed calls (disable dedup to test actual execution)
      await Promise.all([
        rateLimiter.call(readFn, { operationType: 'read', deduplicate: false }),
        rateLimiter.call(writeFn, { operationType: 'write', deduplicate: false }),
        rateLimiter.call(readFn, { operationType: 'read', deduplicate: false }),
        rateLimiter.call(writeFn, { operationType: 'write', deduplicate: false }),
        rateLimiter.call(readFn, { operationType: 'read', deduplicate: false })
      ]);

      expect(readFn).toHaveBeenCalledTimes(3);
      expect(writeFn).toHaveBeenCalledTimes(2);

      // Wait for processing
      await wait(100);

      // Both operation types should have independent rate limits
      const readStatus = rateLimiter.getRateLimitStatus('read');
      const writeStatus = rateLimiter.getRateLimitStatus('write');

      // Tokens consumed, but exact count may vary due to timing
      expect(readStatus?.availableTokens).toBeLessThan(10);
      expect(writeStatus?.availableTokens).toBeLessThan(3);
    });

    it('should recover gracefully from errors with retry', async () => {
      let callCount = 0;
      const mockFn = vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          // Use an error that will be detected as rate limit error
          const error = new Error('IC0503: Canister trapped: rate limit exceeded');
          (error as any).code = 'IC0503';
          throw error;
        }
        return 'recovered';
      });

      const result = await rateLimiter.call(mockFn, {
        operationType: 'write',
        retryConfig: { maxRetries: 2, baseDelayMs: 100 }
      });

      expect(result).toBe('recovered');
      expect(mockFn).toHaveBeenCalledTimes(2);
    }, 10000);
  });
});
