// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Rate Limiter Utility for PropXchain
 *
 * Implements token bucket algorithm for controlling request rates to ICP canisters.
 * Prevents excessive calls that could waste cycles or trigger service disruptions.
 */

/**
 * Configuration for a rate limiter instance
 */
export interface RateLimiterConfig {
  /** Maximum number of tokens in the bucket (burst capacity) */
  maxTokens: number;
  /** Rate at which tokens are refilled (tokens per second) */
  refillRate: number;
  /** Optional name for debugging/logging */
  name?: string;
}

/**
 * Rate limit status information
 */
export interface RateLimitStatus {
  /** Number of tokens currently available */
  availableTokens: number;
  /** Maximum token capacity */
  maxTokens: number;
  /** Whether the rate limiter is currently limiting requests */
  isLimited: boolean;
  /** Time in milliseconds until next token is available */
  timeUntilNextToken: number;
}

/**
 * Token Bucket Rate Limiter
 *
 * Controls the rate of requests using the token bucket algorithm:
 * - Bucket holds up to maxTokens tokens
 * - Tokens refill at a constant rate (refillRate per second)
 * - Each request consumes one token
 * - If no tokens available, request is rate limited
 *
 * @example
 * ```typescript
 * // Limit to 30 requests per minute with burst of 10
 * const limiter = new RateLimiter({
 *   maxTokens: 10,
 *   refillRate: 0.5, // 30 per minute = 0.5 per second
 *   name: 'read-operations'
 * });
 *
 * if (await limiter.acquire()) {
 *   // Make the request
 * } else {
 *   // Rate limited, wait or reject
 * }
 * ```
 */
export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;
  private lastRefillTime: number;
  private readonly name: string;

  /**
   * Create a new rate limiter
   * @param config - Rate limiter configuration
   */
  constructor(config: RateLimiterConfig) {
    this.maxTokens = config.maxTokens;
    this.refillRate = config.refillRate;
    this.tokens = config.maxTokens; // Start with full bucket
    this.lastRefillTime = Date.now();
    this.name = config.name || 'unnamed';
  }

  /**
   * Refill tokens based on elapsed time
   * Called automatically by acquire() and getStatus()
   */
  private refill(): void {
    const now = Date.now();
    const timeSinceLastRefill = (now - this.lastRefillTime) / 1000; // Convert to seconds
    const tokensToAdd = timeSinceLastRefill * this.refillRate;

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefillTime = now;
    }
  }

  /**
   * Attempt to acquire a token for a request
   * @param cost - Number of tokens to consume (default: 1)
   * @returns true if token acquired, false if rate limited
   */
  acquire(cost: number = 1): boolean {
    this.refill();

    if (this.tokens >= cost) {
      this.tokens -= cost;
      return true;
    }

    return false;
  }

  /**
   * Get the number of available tokens
   * @returns Number of tokens currently available
   */
  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  /**
   * Check if requests are currently being rate limited
   * @returns true if no tokens available, false otherwise
   */
  isRateLimited(): boolean {
    this.refill();
    return this.tokens < 1;
  }

  /**
   * Get detailed status information
   * @returns RateLimitStatus object with current state
   */
  getStatus(): RateLimitStatus {
    this.refill();

    const availableTokens = Math.floor(this.tokens);
    const isLimited = this.tokens < 1;

    // Calculate time until next token
    let timeUntilNextToken = 0;
    if (isLimited) {
      const tokensNeeded = 1 - this.tokens;
      timeUntilNextToken = Math.ceil((tokensNeeded / this.refillRate) * 1000); // Convert to ms
    }

    return {
      availableTokens,
      maxTokens: this.maxTokens,
      isLimited,
      timeUntilNextToken
    };
  }

  /**
   * Reset the rate limiter to initial state (full bucket)
   * Useful for testing or manual resets
   */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefillTime = Date.now();
  }

  /**
   * Get the limiter name
   * @returns The name of this rate limiter
   */
  getName(): string {
    return this.name;
  }
}

/**
 * Category-based rate limiter configuration
 */
export interface CategoryRateLimits {
  read: RateLimiterConfig;
  write: RateLimiterConfig;
}

/**
 * Multi-category rate limiter manager
 * Manages separate rate limiters for different operation types
 */
export class CategoryRateLimiter {
  private limiters: Map<string, RateLimiter>;

  /**
   * Create a new category-based rate limiter
   * @param categories - Map of category names to their configurations
   */
  constructor(categories: Record<string, RateLimiterConfig>) {
    this.limiters = new Map();

    for (const [category, config] of Object.entries(categories)) {
      this.limiters.set(category, new RateLimiter({
        ...config,
        name: config.name || category
      }));
    }
  }

  /**
   * Acquire a token from a specific category limiter
   * @param category - The category name
   * @param cost - Number of tokens to consume (default: 1)
   * @returns true if token acquired, false if rate limited
   */
  acquire(category: string, cost: number = 1): boolean {
    const limiter = this.limiters.get(category);
    if (!limiter) {
      return true; // If category doesn't exist, allow the request
    }
    return limiter.acquire(cost);
  }

  /**
   * Get available tokens for a category
   * @param category - The category name
   * @returns Number of available tokens, or Infinity if category doesn't exist
   */
  getAvailableTokens(category: string): number {
    const limiter = this.limiters.get(category);
    if (!limiter) {
      return Infinity;
    }
    return limiter.getAvailableTokens();
  }

  /**
   * Check if a category is rate limited
   * @param category - The category name
   * @returns true if rate limited, false otherwise
   */
  isRateLimited(category: string): boolean {
    const limiter = this.limiters.get(category);
    if (!limiter) {
      return false;
    }
    return limiter.isRateLimited();
  }

  /**
   * Get status for a specific category
   * @param category - The category name
   * @returns RateLimitStatus or null if category doesn't exist
   */
  getStatus(category: string): RateLimitStatus | null {
    const limiter = this.limiters.get(category);
    if (!limiter) {
      return null;
    }
    return limiter.getStatus();
  }

  /**
   * Get status for all categories
   * @returns Map of category names to their status
   */
  getAllStatus(): Map<string, RateLimitStatus> {
    const statusMap = new Map<string, RateLimitStatus>();
    for (const [category, limiter] of this.limiters.entries()) {
      statusMap.set(category, limiter.getStatus());
    }
    return statusMap;
  }

  /**
   * Reset all rate limiters
   */
  resetAll(): void {
    for (const limiter of this.limiters.values()) {
      limiter.reset();
    }
  }

  /**
   * Reset a specific category
   * @param category - The category name
   */
  reset(category: string): void {
    const limiter = this.limiters.get(category);
    if (limiter) {
      limiter.reset();
    }
  }
}

/**
 * Create a rate limiter with default configuration for read operations
 * Default: 30 requests per minute with burst limit of 10
 */
export function createReadRateLimiter(customConfig?: Partial<RateLimiterConfig>): RateLimiter {
  return new RateLimiter({
    maxTokens: 10,
    refillRate: 0.5, // 30 per minute = 0.5 per second
    name: 'read-operations',
    ...customConfig
  });
}

/**
 * Create a rate limiter with default configuration for write operations
 * Default: 10 requests per minute with burst limit of 3
 */
export function createWriteRateLimiter(customConfig?: Partial<RateLimiterConfig>): RateLimiter {
  return new RateLimiter({
    maxTokens: 3,
    refillRate: 0.167, // 10 per minute = 0.167 per second
    name: 'write-operations',
    ...customConfig
  });
}

/**
 * Create a category-based rate limiter with default PropXchain configuration
 */
export function createDefaultCategoryLimiter(): CategoryRateLimiter {
  return new CategoryRateLimiter({
    read: {
      maxTokens: 10,
      refillRate: 0.5, // 30 per minute
      name: 'read-operations'
    },
    write: {
      maxTokens: 3,
      refillRate: 0.167, // 10 per minute
      name: 'write-operations'
    }
  });
}
