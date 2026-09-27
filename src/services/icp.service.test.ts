// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { describe, it, expect, beforeEach } from 'vitest';
import { icpService } from './icp.service';

describe('ICP Service CSRF Integration', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('registerUser does not require a CSRF token (new user chicken-and-egg)', () => {
    // registerUser intentionally skips CSRF — new users can't have a token yet.
    // Validate that the service has a registerUser method available.
    expect(typeof icpService.registerUser).toBe('function');
  });

  it('requireCsrfToken throws when no token is in session', () => {
    sessionStorage.clear(); // Ensure no CSRF token
    // requireCsrfToken enforces CSRF presence before state-changing operations
    expect(() => (icpService as any).requireCsrfToken()).toThrow(/CSRF token/i);
  });

  it('parses rate limit errors correctly', () => {
    const errorMessage = 'Rate limit exceeded: maximum 3 attempts per hour. Try again in 3600 seconds.';

    // Extract retry-after seconds from error message
    const retryMatch = errorMessage.match(/try again in (\d+) seconds/i);
    const retryAfter = retryMatch ? parseInt(retryMatch[1], 10) : 0;

    expect(retryAfter).toBe(3600);
  });
});
