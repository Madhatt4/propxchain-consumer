// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RateLimiter,
  CategoryRateLimiter,
  createReadRateLimiter,
  createWriteRateLimiter,
  createDefaultCategoryLimiter
} from '../rateLimiter';

describe('RateLimiter', () => {
  describe('Token Bucket Algorithm', () => {
    it('should start with full bucket of tokens', () => {
      const limiter = new RateLimiter({
        maxTokens: 10,
        refillRate: 1
      });

      expect(limiter.getAvailableTokens()).toBe(10);
      expect(limiter.isRateLimited()).toBe(false);
    });

    it('should consume tokens on acquire', () => {
      const limiter = new RateLimiter({
        maxTokens: 10,
        refillRate: 1
      });

      expect(limiter.acquire()).toBe(true);
      expect(limiter.getAvailableTokens()).toBe(9);

      expect(limiter.acquire()).toBe(true);
      expect(limiter.getAvailableTokens()).toBe(8);
    });

    it('should reject requests when tokens are exhausted', () => {
      const limiter = new RateLimiter({
        maxTokens: 2,
        refillRate: 0.1
      });

      expect(limiter.acquire()).toBe(true);
      expect(limiter.acquire()).toBe(true);
      expect(limiter.acquire()).toBe(false); // Third request should fail
      expect(limiter.isRateLimited()).toBe(true);
    });

    it('should support custom token costs', () => {
      const limiter = new RateLimiter({
        maxTokens: 10,
        refillRate: 1
      });

      expect(limiter.acquire(5)).toBe(true);
      expect(limiter.getAvailableTokens()).toBe(5);

      expect(limiter.acquire(3)).toBe(true);
      expect(limiter.getAvailableTokens()).toBe(2);

      expect(limiter.acquire(5)).toBe(false); // Not enough tokens
    });
  });

  describe('Token Refill Behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should refill tokens based on time elapsed', async () => {
      const limiter = new RateLimiter({
        maxTokens: 10,
        refillRate: 1 // 1 token per second
      });

      // Exhaust tokens
      for (let i = 0; i < 10; i++) {
        limiter.acquire();
      }
      expect(limiter.getAvailableTokens()).toBe(0);

      // Advance time by 3 seconds
      vi.advanceTimersByTime(3000);

      // Should have refilled 3 tokens
      expect(limiter.getAvailableTokens()).toBe(3);

      vi.useRealTimers();
    });

    it('should not exceed maxTokens when refilling', async () => {
      const limiter = new RateLimiter({
        maxTokens: 5,
        refillRate: 1 // 1 token per second
      });

      // Use one token
      limiter.acquire();
      expect(limiter.getAvailableTokens()).toBe(4);

      // Advance time by 10 seconds (more than needed to fill)
      vi.advanceTimersByTime(10000);

      // Should be capped at maxTokens
      expect(limiter.getAvailableTokens()).toBe(5);

      vi.useRealTimers();
    });

    it('should handle fractional refill rates correctly', async () => {
      const limiter = new RateLimiter({
        maxTokens: 10,
        refillRate: 0.5 // 0.5 tokens per second = 1 token per 2 seconds
      });

      // Exhaust tokens
      for (let i = 0; i < 10; i++) {
        limiter.acquire();
      }

      // Advance time by 4 seconds (should refill 2 tokens)
      vi.advanceTimersByTime(4000);

      expect(limiter.getAvailableTokens()).toBe(2);

      vi.useRealTimers();
    });
  });

  describe('Status Reporting', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should provide accurate status information', () => {
      const limiter = new RateLimiter({
        maxTokens: 10,
        refillRate: 1,
        name: 'test-limiter'
      });

      limiter.acquire(6);

      const status = limiter.getStatus();
      expect(status.availableTokens).toBe(4);
      expect(status.maxTokens).toBe(10);
      expect(status.isLimited).toBe(false);
      expect(status.timeUntilNextToken).toBe(0);
    });

    it('should calculate time until next token when limited', () => {
      const limiter = new RateLimiter({
        maxTokens: 2,
        refillRate: 1 // 1 token per second
      });

      // Exhaust tokens
      limiter.acquire(2);

      const status = limiter.getStatus();
      expect(status.isLimited).toBe(true);
      expect(status.timeUntilNextToken).toBeGreaterThan(0);
      expect(status.timeUntilNextToken).toBeLessThanOrEqual(1000);

      vi.useRealTimers();
    });

    it('should expose limiter name', () => {
      const limiter = new RateLimiter({
        maxTokens: 5,
        refillRate: 1,
        name: 'my-custom-limiter'
      });

      expect(limiter.getName()).toBe('my-custom-limiter');
    });
  });

  describe('Reset Functionality', () => {
    it('should reset to full bucket on reset()', () => {
      const limiter = new RateLimiter({
        maxTokens: 10,
        refillRate: 1
      });

      // Consume tokens
      limiter.acquire(8);
      expect(limiter.getAvailableTokens()).toBe(2);

      // Reset
      limiter.reset();
      expect(limiter.getAvailableTokens()).toBe(10);
      expect(limiter.isRateLimited()).toBe(false);
    });
  });
});

describe('CategoryRateLimiter', () => {
  describe('Multi-Category Management', () => {
    it('should manage separate rate limiters for each category', () => {
      const limiter = new CategoryRateLimiter({
        read: {
          maxTokens: 10,
          refillRate: 0.5
        },
        write: {
          maxTokens: 3,
          refillRate: 0.167
        }
      });

      expect(limiter.getAvailableTokens('read')).toBe(10);
      expect(limiter.getAvailableTokens('write')).toBe(3);
    });

    it('should independently track requests per category', () => {
      const limiter = new CategoryRateLimiter({
        read: {
          maxTokens: 10,
          refillRate: 1
        },
        write: {
          maxTokens: 5,
          refillRate: 0.5
        }
      });

      // Acquire read tokens
      limiter.acquire('read', 5);
      expect(limiter.getAvailableTokens('read')).toBe(5);

      // Write tokens should be unaffected
      expect(limiter.getAvailableTokens('write')).toBe(5);

      // Acquire write tokens
      limiter.acquire('write', 3);
      expect(limiter.getAvailableTokens('write')).toBe(2);

      // Read tokens should be unaffected
      expect(limiter.getAvailableTokens('read')).toBe(5);
    });

    it('should return true for non-existent categories', () => {
      const limiter = new CategoryRateLimiter({
        read: {
          maxTokens: 10,
          refillRate: 1
        }
      });

      expect(limiter.acquire('nonexistent')).toBe(true);
      expect(limiter.isRateLimited('nonexistent')).toBe(false);
      expect(limiter.getAvailableTokens('nonexistent')).toBe(Infinity);
    });
  });

  describe('Status Reporting', () => {
    it('should provide status for specific categories', () => {
      const limiter = new CategoryRateLimiter({
        read: {
          maxTokens: 10,
          refillRate: 1,
          name: 'read-ops'
        },
        write: {
          maxTokens: 5,
          refillRate: 0.5,
          name: 'write-ops'
        }
      });

      limiter.acquire('read', 6);

      const readStatus = limiter.getStatus('read');
      expect(readStatus).not.toBeNull();
      expect(readStatus!.availableTokens).toBe(4);
      expect(readStatus!.maxTokens).toBe(10);

      const writeStatus = limiter.getStatus('write');
      expect(writeStatus).not.toBeNull();
      expect(writeStatus!.availableTokens).toBe(5);
    });

    it('should return null for non-existent category status', () => {
      const limiter = new CategoryRateLimiter({
        read: {
          maxTokens: 10,
          refillRate: 1
        }
      });

      expect(limiter.getStatus('nonexistent')).toBeNull();
    });

    it('should provide status for all categories', () => {
      const limiter = new CategoryRateLimiter({
        read: {
          maxTokens: 10,
          refillRate: 1
        },
        write: {
          maxTokens: 5,
          refillRate: 0.5
        }
      });

      const allStatus = limiter.getAllStatus();
      expect(allStatus.size).toBe(2);
      expect(allStatus.has('read')).toBe(true);
      expect(allStatus.has('write')).toBe(true);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset specific category', () => {
      const limiter = new CategoryRateLimiter({
        read: {
          maxTokens: 10,
          refillRate: 1
        },
        write: {
          maxTokens: 5,
          refillRate: 0.5
        }
      });

      limiter.acquire('read', 8);
      limiter.acquire('write', 4);

      expect(limiter.getAvailableTokens('read')).toBe(2);
      expect(limiter.getAvailableTokens('write')).toBe(1);

      limiter.reset('read');

      expect(limiter.getAvailableTokens('read')).toBe(10);
      expect(limiter.getAvailableTokens('write')).toBe(1); // Unchanged
    });

    it('should reset all categories', () => {
      const limiter = new CategoryRateLimiter({
        read: {
          maxTokens: 10,
          refillRate: 1
        },
        write: {
          maxTokens: 5,
          refillRate: 0.5
        }
      });

      limiter.acquire('read', 8);
      limiter.acquire('write', 4);

      limiter.resetAll();

      expect(limiter.getAvailableTokens('read')).toBe(10);
      expect(limiter.getAvailableTokens('write')).toBe(5);
    });
  });
});

describe('Helper Functions', () => {
  describe('createReadRateLimiter', () => {
    it('should create rate limiter with default read configuration', () => {
      const limiter = createReadRateLimiter();

      expect(limiter.getAvailableTokens()).toBe(10);
      expect(limiter.getName()).toBe('read-operations');
    });

    it('should allow custom configuration overrides', () => {
      const limiter = createReadRateLimiter({
        maxTokens: 20,
        name: 'custom-read'
      });

      expect(limiter.getAvailableTokens()).toBe(20);
      expect(limiter.getName()).toBe('custom-read');
    });
  });

  describe('createWriteRateLimiter', () => {
    it('should create rate limiter with default write configuration', () => {
      const limiter = createWriteRateLimiter();

      expect(limiter.getAvailableTokens()).toBe(3);
      expect(limiter.getName()).toBe('write-operations');
    });

    it('should allow custom configuration overrides', () => {
      const limiter = createWriteRateLimiter({
        maxTokens: 5,
        name: 'custom-write'
      });

      expect(limiter.getAvailableTokens()).toBe(5);
      expect(limiter.getName()).toBe('custom-write');
    });
  });

  describe('createDefaultCategoryLimiter', () => {
    it('should create category limiter with default PropXchain configuration', () => {
      const limiter = createDefaultCategoryLimiter();

      expect(limiter.getAvailableTokens('read')).toBe(10);
      expect(limiter.getAvailableTokens('write')).toBe(3);
    });
  });
});
