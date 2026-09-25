import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  OAUTH_SIGNUP_INTENT_KEY,
  rememberOAuthSignUpIntent,
  clearOAuthSignUpIntent,
  consumeOAuthSignUpIntent,
} from '../oauthSignUpIntent';

describe('oauthSignUpIntent', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should report a sign-up intent that was recorded before the redirect', () => {
    rememberOAuthSignUpIntent();

    expect(consumeOAuthSignUpIntent()).toBe(true);
  });

  it('should report no intent when the redirect started from a sign-in page', () => {
    expect(consumeOAuthSignUpIntent()).toBe(false);
  });

  it('should clear the flag on read, so a later sign-in is not mistaken for a sign-up', () => {
    rememberOAuthSignUpIntent();

    expect(consumeOAuthSignUpIntent()).toBe(true);
    expect(consumeOAuthSignUpIntent()).toBe(false);
    expect(sessionStorage.getItem(OAUTH_SIGNUP_INTENT_KEY)).toBeNull();
  });

  it('should drop the flag when a redirect that never happened is abandoned', () => {
    rememberOAuthSignUpIntent();

    clearOAuthSignUpIntent();

    expect(consumeOAuthSignUpIntent()).toBe(false);
  });

  it('should treat unavailable storage as no intent rather than throwing', () => {
    // Private browsing and hardened settings throw on access. The notice is a
    // courtesy, so losing it must never break the callback.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    expect(() => consumeOAuthSignUpIntent()).not.toThrow();
    expect(consumeOAuthSignUpIntent()).toBe(false);
  });

  it('should not throw when storage rejects the write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    expect(() => rememberOAuthSignUpIntent()).not.toThrow();
  });
});
