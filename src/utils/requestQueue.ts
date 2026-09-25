// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Request Queue Manager for PropXchain
 *
 * Manages concurrent requests to ICP canisters and prevents burst calls.
 * Queues excess requests and processes them with controlled concurrency.
 */

/**
 * Priority levels for queued requests
 */
export enum RequestPriority {
  /** Critical operations that should be processed first */
  HIGH = 3,
  /** Standard operations (default) */
  NORMAL = 2,
  /** Background operations that can wait */
  LOW = 1
}

/**
 * Configuration for a request queue instance
 */
export interface RequestQueueConfig {
  /** Maximum number of concurrent requests allowed (default: 3) */
  maxConcurrent?: number;
  /** Optional name for debugging/logging */
  name?: string;
}

/**
 * Internal queue item structure
 */
interface QueuedRequest<T> {
  /** Unique identifier for this request */
  id: string;
  /** The function to execute */
  fn: () => Promise<T>;
  /** Priority level */
  priority: RequestPriority;
  /** Promise resolve function */
  resolve: (value: T) => void;
  /** Promise reject function */
  reject: (error: any) => void;
  /** Timestamp when the request was enqueued */
  enqueuedAt: number;
}

/**
 * Queue status information
 */
export interface QueueStatus {
  /** Number of requests currently being processed */
  activeCount: number;
  /** Number of requests waiting in queue */
  pendingCount: number;
  /** Total capacity (max concurrent) */
  maxConcurrent: number;
  /** Whether the queue is at full capacity */
  isAtCapacity: boolean;
}

/**
 * Request Queue for managing concurrent canister calls
 *
 * Controls the number of simultaneous requests to prevent overwhelming
 * the system and ensures fair processing with priority levels.
 *
 * Features:
 * - FIFO queue with priority support
 * - Configurable concurrency limit
 * - Automatic request processing
 * - Promise-based API
 *
 * @example
 * ```typescript
 * const queue = new RequestQueue({ maxConcurrent: 3 });
 *
 * // Enqueue a normal priority request
 * const result = await queue.enqueue(
 *   async () => await icpService.getAllTransactions()
 * );
 *
 * // Enqueue a high priority request
 * const criticalResult = await queue.enqueue(
 *   async () => await icpService.createTransaction(data),
 *   RequestPriority.HIGH
 * );
 *
 * // Check queue status
 * const status = queue.getStatus();
 * console.log(`Active: ${status.activeCount}, Pending: ${status.pendingCount}`);
 * ```
 */
export class RequestQueue {
  private readonly maxConcurrent: number;
  private readonly name: string;
  private activeRequests: Set<string>;
  private queue: QueuedRequest<any>[];
  private requestIdCounter: number;

  /**
   * Create a new request queue
   * @param config - Queue configuration
   */
  constructor(config: RequestQueueConfig = {}) {
    this.maxConcurrent = config.maxConcurrent ?? 3;
    this.name = config.name || 'unnamed';
    this.activeRequests = new Set();
    this.queue = [];
    this.requestIdCounter = 0;
  }

  /**
   * Enqueue a request to be processed
   *
   * @param fn - Async function to execute
   * @param priority - Priority level (default: NORMAL)
   * @returns Promise that resolves with the function result
   *
   * @example
   * ```typescript
   * // Normal priority request
   * const data = await queue.enqueue(
   *   async () => await fetchData()
   * );
   *
   * // High priority request
   * const critical = await queue.enqueue(
   *   async () => await saveCriticalData(),
   *   RequestPriority.HIGH
   * );
   * ```
   */
  enqueue<T>(
    fn: () => Promise<T>,
    priority: RequestPriority = RequestPriority.NORMAL
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = this.generateRequestId();
      const request: QueuedRequest<T> = {
        id,
        fn,
        priority,
        resolve,
        reject,
        enqueuedAt: Date.now()
      };

      // Insert into queue based on priority (higher priority first, then FIFO)
      this.insertByPriority(request);

      // Try to process immediately if capacity available
      this.processNext();
    });
  }

  /**
   * Get the current number of items in the queue
   * @returns Number of pending requests
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Get detailed queue status
   * @returns QueueStatus object with current state
   */
  getStatus(): QueueStatus {
    return {
      activeCount: this.activeRequests.size,
      pendingCount: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      isAtCapacity: this.activeRequests.size >= this.maxConcurrent
    };
  }

  /**
   * Flush all pending requests
   *
   * Cancels all queued requests that haven't started executing yet.
   * Already running requests will continue to completion.
   *
   * @returns Number of requests that were flushed
   */
  flush(): number {
    const flushedCount = this.queue.length;

    // Reject all pending requests
    for (const request of this.queue) {
      request.reject(new Error('Request queue flushed'));
    }

    // Clear the queue
    this.queue = [];

    return flushedCount;
  }

  /**
   * Wait for all active requests to complete
   *
   * @returns Promise that resolves when queue is empty and all requests are done
   */
  async drain(): Promise<void> {
    while (this.activeRequests.size > 0 || this.queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Get the queue name
   * @returns The name of this queue
   */
  getName(): string {
    return this.name;
  }

  /**
   * Generate a unique request ID
   * @private
   */
  private generateRequestId(): string {
    return `req-${this.name}-${++this.requestIdCounter}-${Date.now()}`;
  }

  /**
   * Insert a request into the queue based on priority
   * Higher priority requests go to the front, same priority uses FIFO
   * @private
   */
  private insertByPriority<T>(request: QueuedRequest<T>): void {
    // Find the insertion point
    let insertIndex = this.queue.length;

    for (let i = 0; i < this.queue.length; i++) {
      if (request.priority > this.queue[i].priority) {
        insertIndex = i;
        break;
      }
    }

    // Insert at the calculated position
    this.queue.splice(insertIndex, 0, request);
  }

  /**
   * Process the next request in the queue if capacity is available
   * @private
   */
  private processNext(): void {
    // Check if we have capacity
    if (this.activeRequests.size >= this.maxConcurrent) {
      return;
    }

    // Get next request from queue
    const request = this.queue.shift();
    if (!request) {
      return;
    }

    // Mark as active
    this.activeRequests.add(request.id);

    // Execute the request
    this.executeRequest(request);
  }

  /**
   * Execute a queued request
   * @private
   */
  private async executeRequest<T>(request: QueuedRequest<T>): Promise<void> {
    try {
      const result = await request.fn();
      request.resolve(result);
    } catch (error) {
      request.reject(error);
    } finally {
      // Remove from active set
      this.activeRequests.delete(request.id);

      // Process next request if any
      this.processNext();
    }
  }
}

/**
 * Create a request queue with default configuration for PropXchain
 * Default: max 3 concurrent requests
 */
export function createDefaultRequestQueue(customConfig?: Partial<RequestQueueConfig>): RequestQueue {
  return new RequestQueue({
    maxConcurrent: 3,
    name: 'default-queue',
    ...customConfig
  });
}

/**
 * Create a request queue optimized for high-priority operations
 * Allows more concurrent requests for critical operations
 */
export function createHighPriorityQueue(customConfig?: Partial<RequestQueueConfig>): RequestQueue {
  return new RequestQueue({
    maxConcurrent: 5,
    name: 'high-priority-queue',
    ...customConfig
  });
}

/**
 * Create a request queue optimized for background operations
 * Limits concurrency to prevent background tasks from overwhelming the system
 */
export function createBackgroundQueue(customConfig?: Partial<RequestQueueConfig>): RequestQueue {
  return new RequestQueue({
    maxConcurrent: 1,
    name: 'background-queue',
    ...customConfig
  });
}
