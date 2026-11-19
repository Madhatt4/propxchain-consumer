// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

// supabase-js keeps the saved session whenever the sign-out request itself
// fails (offline, a 5xx) and reports that as a returned error, not a throw.
// On a shared computer the next page load then signs the last user back in.
// These tests run the real client against a stubbed network so they hold
// supabase-js to the behaviour the fix relies on.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/analytics', () => ({ trackSignUp: vi.fn() }));
vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { AUTH_STORAGE_KEY } from '@/lib/supabase';
import { supabaseAuthService } from '../supabase.auth.service';

const ONE_HOUR_SECONDS = 3600;

function seedStoredSession(): void {
  const expiresAt = Math.floor(Date.now() / 1000) + ONE_HOUR_SECONDS;
  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      token_type: 'bearer',
      expires_in: ONE_HOUR_SECONDS,
      expires_at: expiresAt,
      user: { id: '00000000-0000-0000-0000-000000000001', email: 'test.user@example.com' },
    }),
  );
}

describe('supabaseAuthService.signOut', () => {
  beforeEach(() => {
    localStorage.clear();
    seedStoredSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should remove the stored session when the sign-out request cannot reach the server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await supabaseAuthService.signOut();

    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it('should remove the stored session when the server answers with an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'unavailable' }), { status: 503 })),
    );

    await supabaseAuthService.signOut();

    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it('should remove the stored session on an ordinary sign-out', async () => {
    const fetchStub = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchStub);

    await supabaseAuthService.signOut();

    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it('should leave unrelated browser storage alone when it clears the session itself', async () => {
    localStorage.setItem('unrelated_pref', 'kept');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await supabaseAuthService.signOut();

    expect(localStorage.getItem('unrelated_pref')).toBe('kept');
  });
});
