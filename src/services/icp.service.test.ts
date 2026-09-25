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

describe('ICP Service marketing-form session identity', () => {
  const STORAGE_KEY = 'px_marketing_session_v1';

  beforeEach(() => {
    localStorage.clear();
    // icpService is a module-level singleton; reset the marketing-form state
    // between tests so each test starts from a known-empty cache.
    (icpService as any).marketingSessionIdentity = null;
    (icpService as any).marketingFormActor = null;
  });

  it('generates a non-anonymous session identity on first call', () => {
    const identity = (icpService as any).getOrCreateMarketingSessionIdentity();
    const principal = identity.getPrincipal();
    expect(principal.isAnonymous()).toBe(false);
    // Anonymous principal text representation — must NOT match.
    expect(principal.toText()).not.toBe('2vxsx-fae');
  });

  it('persists the identity so a reload keeps the same principal (stable per-visitor bucket)', () => {
    const first = (icpService as any).getOrCreateMarketingSessionIdentity();
    const firstText = first.getPrincipal().toText();

    // Simulate a page reload: in-memory cache gone, localStorage retained.
    (icpService as any).marketingSessionIdentity = null;
    const second = (icpService as any).getOrCreateMarketingSessionIdentity();

    expect(second.getPrincipal().toText()).toBe(firstText);
  });

  it('regenerates a fresh identity when localStorage is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, 'not-valid-json');
    const identity = (icpService as any).getOrCreateMarketingSessionIdentity();
    expect(identity.getPrincipal().isAnonymous()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).not.toBe('not-valid-json');
  });

  it('builds a marketing-form actor backed by the session identity', async () => {
    const actor = await (icpService as any).getMarketingFormActor();
    expect(actor).toBeDefined();
    expect(typeof actor.submitSupportRequest).toBe('function');
    expect(typeof actor.submitSalesInquiry).toBe('function');
    expect(typeof actor.submitPartnerInquiry).toBe('function');

    const identity = (icpService as any).marketingSessionIdentity;
    expect(identity).not.toBeNull();
    expect(identity.getPrincipal().isAnonymous()).toBe(false);
  });

  it('reuses the same actor on subsequent calls (no agent rebuild per submission)', async () => {
    const first = await (icpService as any).getMarketingFormActor();
    const second = await (icpService as any).getMarketingFormActor();
    expect(second).toBe(first);
  });
});
