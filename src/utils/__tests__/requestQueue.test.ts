// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import {
  RequestQueue,
  RequestPriority,
  createDefaultRequestQueue,
  createHighPriorityQueue,
  createBackgroundQueue
} from '../requestQueue';

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

describe('RequestQueue', () => {
  describe('Basic Queue Operations', () => {
    it('should process requests up to maxConcurrent limit', async () => {
      const queue = new RequestQueue({ maxConcurrent: 2 });
      const executionOrder: number[] = [];

      const createRequest = (id: number, delay: number = 10) => async () => {
        executionOrder.push(id);
        await new Promise(resolve => setTimeout(resolve, delay));
        return id;
      };

      // Enqueue 5 requests with max 2 concurrent
      const promises = [
        queue.enqueue(createRequest(1)),
        queue.enqueue(createRequest(2)),
        queue.enqueue(createRequest(3)),
        queue.enqueue(createRequest(4)),
        queue.enqueue(createRequest(5))
      ];

      // Wait a bit for first 2 to start
      await new Promise(resolve => setTimeout(resolve, 5));

      // Check that only 2 are executing initially
      const status = queue.getStatus();
      expect(status.activeCount).toBeLessThanOrEqual(2);
      expect(status.pendingCount).toBeGreaterThan(0);

      // Wait for all to complete
      const results = await Promise.all(promises);

      expect(results).toEqual([1, 2, 3, 4, 5]);
      expect(executionOrder).toEqual([1, 2, 3, 4, 5]);
    });

    it('should return correct queue length', async () => {
      const queue = new RequestQueue({ maxConcurrent: 1 });

      const slowRequest = () => new Promise(resolve => setTimeout(() => resolve('done'), 100));

      queue.enqueue(slowRequest);
      queue.enqueue(slowRequest);
      queue.enqueue(slowRequest);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(queue.getQueueLength()).toBe(2); // 1 active, 2 queued
    });

    it('should process requests in FIFO order by default', async () => {
      const queue = new RequestQueue({ maxConcurrent: 1 });
      const executionOrder: number[] = [];

      const createRequest = (id: number) => async () => {
        executionOrder.push(id);
        return id;
      };

      await Promise.all([
        queue.enqueue(createRequest(1)),
        queue.enqueue(createRequest(2)),
        queue.enqueue(createRequest(3)),
        queue.enqueue(createRequest(4))
      ]);

      expect(executionOrder).toEqual([1, 2, 3, 4]);
    });
  });

  describe('Priority Queue Ordering', () => {
    it('should prioritize HIGH priority requests', async () => {
      const queue = new RequestQueue({ maxConcurrent: 1 });
      const executionOrder: number[] = [];

      const blockingRequest = () => new Promise(resolve => setTimeout(() => resolve('done'), 50));
      const createRequest = (id: number) => async () => {
        executionOrder.push(id);
        return id;
      };

      // Start a blocking request
      queue.enqueue(blockingRequest, RequestPriority.NORMAL);

      // Enqueue requests with different priorities while first one is running
      await new Promise(resolve => setTimeout(resolve, 10));

      queue.enqueue(createRequest(1), RequestPriority.NORMAL);
      queue.enqueue(createRequest(2), RequestPriority.HIGH);
      queue.enqueue(createRequest(3), RequestPriority.LOW);
      queue.enqueue(createRequest(4), RequestPriority.HIGH);

      await queue.drain();

      // HIGH priority should execute before NORMAL and LOW
      expect(executionOrder[0]).toBe(2); // First HIGH
      expect(executionOrder[1]).toBe(4); // Second HIGH
      expect(executionOrder[2]).toBe(1); // Then NORMAL
      expect(executionOrder[3]).toBe(3); // Finally LOW
    });

    it('should maintain FIFO within same priority level', async () => {
      const queue = new RequestQueue({ maxConcurrent: 1 });
      const executionOrder: number[] = [];

      const blockingRequest = () => new Promise(resolve => setTimeout(() => resolve('done'), 50));
      const createRequest = (id: number) => async () => {
        executionOrder.push(id);
        return id;
      };

      queue.enqueue(blockingRequest, RequestPriority.NORMAL);
      await new Promise(resolve => setTimeout(resolve, 10));

      // All same priority
      queue.enqueue(createRequest(1), RequestPriority.NORMAL);
      queue.enqueue(createRequest(2), RequestPriority.NORMAL);
      queue.enqueue(createRequest(3), RequestPriority.NORMAL);

      await queue.drain();

      expect(executionOrder).toEqual([1, 2, 3]);
    });
  });

  describe('Promise Resolution', () => {
    it('should resolve promises with function results', async () => {
      const queue = new RequestQueue({ maxConcurrent: 3 });

      const result1 = await queue.enqueue(async () => 'result1');
      const result2 = await queue.enqueue(async () => 42);
      const result3 = await queue.enqueue(async () => ({ key: 'value' }));

      expect(result1).toBe('result1');
      expect(result2).toBe(42);
      expect(result3).toEqual({ key: 'value' });
    });

    it('should reject promises when function throws', async () => {
      const queue = new RequestQueue({ maxConcurrent: 2 });

      const errorRequest = async () => {
        throw new Error('Request failed');
      };

      await expect(queue.enqueue(errorRequest)).rejects.toThrow('Request failed');
    });

    it('should handle mixed success and failure', async () => {
      const queue = new RequestQueue({ maxConcurrent: 2 });

      const successRequest = async () => 'success';
      const failureRequest = async () => {
        throw new Error('failure');
      };

      const results = await Promise.allSettled([
        queue.enqueue(successRequest),
        queue.enqueue(failureRequest),
        queue.enqueue(successRequest)
      ]);

      expect(results[0]).toEqual({ status: 'fulfilled', value: 'success' });
      expect(results[1]).toEqual({ status: 'rejected', reason: expect.any(Error) });
      expect(results[2]).toEqual({ status: 'fulfilled', value: 'success' });
    });
  });

  describe('Queue Status', () => {
    it('should provide accurate status information', async () => {
      const queue = new RequestQueue({ maxConcurrent: 2, name: 'test-queue' });

      const slowRequest = () => new Promise(resolve => setTimeout(() => resolve('done'), 100));

      queue.enqueue(slowRequest);
      queue.enqueue(slowRequest);
      queue.enqueue(slowRequest);
      queue.enqueue(slowRequest);

      await new Promise(resolve => setTimeout(resolve, 10));

      const status = queue.getStatus();
      expect(status.maxConcurrent).toBe(2);
      expect(status.activeCount).toBe(2);
      expect(status.pendingCount).toBe(2);
      expect(status.isAtCapacity).toBe(true);

      await queue.drain();

      const finalStatus = queue.getStatus();
      expect(finalStatus.activeCount).toBe(0);
      expect(finalStatus.pendingCount).toBe(0);
      expect(finalStatus.isAtCapacity).toBe(false);
    });

    it('should expose queue name', () => {
      const queue = new RequestQueue({ name: 'my-queue' });
      expect(queue.getName()).toBe('my-queue');
    });

    it('should use default name when not specified', () => {
      const queue = new RequestQueue();
      expect(queue.getName()).toBe('unnamed');
    });
  });

  describe('Flush Functionality', () => {
    it('should cancel all pending requests', async () => {
      const queue = new RequestQueue({ maxConcurrent: 1 });

      const slowRequest = () => new Promise(resolve => setTimeout(() => resolve('done'), 100));
      const quickRequest = vi.fn().mockResolvedValue('quick');

      queue.enqueue(slowRequest);
      const promise1 = queue.enqueue(quickRequest);
      const promise2 = queue.enqueue(quickRequest);
      const promise3 = queue.enqueue(quickRequest);

      await new Promise(resolve => setTimeout(resolve, 10));

      const flushedCount = queue.flush();
      expect(flushedCount).toBeGreaterThan(0);

      await expect(promise1).rejects.toThrow('Request queue flushed');
      await expect(promise2).rejects.toThrow('Request queue flushed');
      await expect(promise3).rejects.toThrow('Request queue flushed');

      expect(quickRequest).not.toHaveBeenCalled();
    });

    it('should not affect actively running requests', async () => {
      const queue = new RequestQueue({ maxConcurrent: 2 });
      const results: string[] = [];

      const runningRequest = async (id: string) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        results.push(id);
        return id;
      };

      const p1 = queue.enqueue(() => runningRequest('running1'));
      const p2 = queue.enqueue(() => runningRequest('running2'));
      queue.enqueue(() => runningRequest('queued1'));
      queue.enqueue(() => runningRequest('queued2'));

      await new Promise(resolve => setTimeout(resolve, 10));

      queue.flush();

      const [r1, r2] = await Promise.all([p1, p2]);
      expect([r1, r2]).toEqual(['running1', 'running2']);
      expect(results).toEqual(['running1', 'running2']);
    });

    it('should return 0 when queue is empty', () => {
      const queue = new RequestQueue();
      expect(queue.flush()).toBe(0);
    });
  });

  describe('Drain Functionality', () => {
    it('should wait for all requests to complete', async () => {
      const queue = new RequestQueue({ maxConcurrent: 2 });
      const executionOrder: number[] = [];

      const createRequest = (id: number) => async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        executionOrder.push(id);
        return id;
      };

      queue.enqueue(createRequest(1));
      queue.enqueue(createRequest(2));
      queue.enqueue(createRequest(3));
      queue.enqueue(createRequest(4));

      await queue.drain();

      expect(executionOrder).toEqual([1, 2, 3, 4]);
      expect(queue.getQueueLength()).toBe(0);
      expect(queue.getStatus().activeCount).toBe(0);
    });

    it('should handle empty queue', async () => {
      const queue = new RequestQueue();
      await queue.drain(); // Should not hang
      expect(queue.getQueueLength()).toBe(0);
    });
  });

  describe('Concurrency Control', () => {
    it('should never exceed maxConcurrent limit', async () => {
      const queue = new RequestQueue({ maxConcurrent: 3 });
      let currentConcurrent = 0;
      let maxConcurrentObserved = 0;

      const createRequest = () => async () => {
        currentConcurrent++;
        maxConcurrentObserved = Math.max(maxConcurrentObserved, currentConcurrent);
        await new Promise(resolve => setTimeout(resolve, 20));
        currentConcurrent--;
      };

      const promises = Array.from({ length: 20 }, () => queue.enqueue(createRequest()));
      await Promise.all(promises);

      expect(maxConcurrentObserved).toBeLessThanOrEqual(3);
    });

    it('should process new requests as capacity becomes available', async () => {
      const queue = new RequestQueue({ maxConcurrent: 2 });
      const executionTimes: number[] = [];

      const createRequest = (id: number) => async () => {
        executionTimes.push(Date.now());
        await new Promise(resolve => setTimeout(resolve, 50));
        return id;
      };

      const startTime = Date.now();

      await Promise.all([
        queue.enqueue(createRequest(1)),
        queue.enqueue(createRequest(2)),
        queue.enqueue(createRequest(3)),
        queue.enqueue(createRequest(4))
      ]);

      // First 2 should start immediately (within 10ms)
      expect(executionTimes[0] - startTime).toBeLessThan(10);
      expect(executionTimes[1] - startTime).toBeLessThan(10);

      // Next 2 should wait for capacity
      expect(executionTimes[2] - startTime).toBeGreaterThan(40);
      expect(executionTimes[3] - startTime).toBeGreaterThan(40);
    });
  });
});

describe('Helper Functions', () => {
  describe('createDefaultRequestQueue', () => {
    it('should create queue with default configuration', () => {
      const queue = createDefaultRequestQueue();

      const status = queue.getStatus();
      expect(status.maxConcurrent).toBe(3);
      expect(queue.getName()).toBe('default-queue');
    });

    it('should allow custom configuration overrides', () => {
      const queue = createDefaultRequestQueue({
        maxConcurrent: 5,
        name: 'custom'
      });

      expect(queue.getStatus().maxConcurrent).toBe(5);
      expect(queue.getName()).toBe('custom');
    });
  });

  describe('createHighPriorityQueue', () => {
    it('should create queue with higher concurrency', () => {
      const queue = createHighPriorityQueue();

      expect(queue.getStatus().maxConcurrent).toBe(5);
      expect(queue.getName()).toBe('high-priority-queue');
    });
  });

  describe('createBackgroundQueue', () => {
    it('should create queue with limited concurrency', () => {
      const queue = createBackgroundQueue();

      expect(queue.getStatus().maxConcurrent).toBe(1);
      expect(queue.getName()).toBe('background-queue');
    });
  });
});

describe('Real-world Scenarios', () => {
  it('should handle multiple canister calls with rate limiting', async () => {
    const queue = new RequestQueue({ maxConcurrent: 3 });
    const apiCallCount: Record<string, number> = {};

    const mockApiCall = (endpoint: string) => async () => {
      apiCallCount[endpoint] = (apiCallCount[endpoint] || 0) + 1;
      await new Promise(resolve => setTimeout(resolve, 30));
      return { endpoint, count: apiCallCount[endpoint] };
    };

    // Simulate multiple API calls
    const results = await Promise.all([
      queue.enqueue(mockApiCall('getAllTransactions'), RequestPriority.HIGH),
      queue.enqueue(mockApiCall('getAllUsers'), RequestPriority.NORMAL),
      queue.enqueue(mockApiCall('getMyProfile'), RequestPriority.HIGH),
      queue.enqueue(mockApiCall('createTransaction'), RequestPriority.HIGH),
      queue.enqueue(mockApiCall('updateUser'), RequestPriority.NORMAL),
      queue.enqueue(mockApiCall('deleteDocument'), RequestPriority.LOW)
    ]);

    expect(results).toHaveLength(6);
    expect(apiCallCount['getAllTransactions']).toBe(1);
    expect(apiCallCount['getAllUsers']).toBe(1);
  });

  it('should handle request deduplication pattern', async () => {
    const queue = new RequestQueue({ maxConcurrent: 2 });
    const cache = new Map<string, Promise<any>>();

    const dedupedRequest = async (key: string, fn: () => Promise<any>) => {
      if (cache.has(key)) {
        return cache.get(key);
      }

      const promise = queue.enqueue(fn);
      cache.set(key, promise);

      try {
        const result = await promise;
        cache.delete(key);
        return result;
      } catch (error) {
        cache.delete(key);
        throw error;
      }
    };

    const mockFetch = vi.fn().mockResolvedValue('data');

    // Multiple calls for same resource
    const results = await Promise.all([
      dedupedRequest('user-123', mockFetch),
      dedupedRequest('user-123', mockFetch),
      dedupedRequest('user-123', mockFetch)
    ]);

    expect(results).toEqual(['data', 'data', 'data']);
    expect(mockFetch).toHaveBeenCalledTimes(1); // Only called once due to deduplication
  });
});
