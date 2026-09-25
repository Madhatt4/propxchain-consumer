// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionManager } from './sessionManager';

describe('SessionManager', () => {
  beforeEach(() => {
    // Clear sessionStorage before each test
    sessionStorage.clear();
    // Reset singleton instance
    vi.unstubAllGlobals();
  });

  it('creates session with expiry timestamp in the future', () => {
    const manager = SessionManager.getInstance();
    const now = Date.now();
    manager.setSession({ principalId: 'test-principal', isAuthenticated: true });

    const expiry = parseInt(sessionStorage.getItem('sessionExpiry') || '0');

    expect(expiry).toBeGreaterThan(now);
    expect(expiry - now).toBeCloseTo(24 * 60 * 60 * 1000, -2); // ~24 hours
  });

  it('returns false for expired sessions', () => {
    const manager = SessionManager.getInstance();
    manager.setSession({ principalId: 'test-principal', isAuthenticated: true });

    // Manually set expired timestamp
    sessionStorage.setItem('sessionExpiry', (Date.now() - 1000).toString());

    expect(manager.isSessionValid()).toBe(false);
  });

  it('clears all session data on clearSession()', () => {
    const manager = SessionManager.getInstance();
    manager.setSession({
      principalId: 'test-principal',
      isAuthenticated: true,
      csrfToken: 'token123',
      userType: 'buyer'
    });

    manager.clearSession();

    expect(sessionStorage.getItem('principalId')).toBeNull();
    expect(sessionStorage.getItem('sessionExpiry')).toBeNull();
    expect(sessionStorage.getItem('csrfToken')).toBeNull();
    expect(sessionStorage.getItem('isAuthenticated')).toBeNull();
    expect(sessionStorage.getItem('userType')).toBeNull();
  });

  it('returns true for valid sessions', () => {
    const manager = SessionManager.getInstance();
    manager.setSession({ principalId: 'test-principal', isAuthenticated: true });

    expect(manager.isSessionValid()).toBe(true);
  });

  it('auto-clears expired sessions on isSessionValid()', () => {
    const manager = SessionManager.getInstance();
    manager.setSession({ principalId: 'test-principal', isAuthenticated: true });

    // Set expired timestamp
    sessionStorage.setItem('sessionExpiry', (Date.now() - 1000).toString());

    manager.isSessionValid();

    expect(sessionStorage.getItem('principalId')).toBeNull();
  });
});
