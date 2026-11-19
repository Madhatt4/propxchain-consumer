// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

// In the phone app the session lives in the Keychain / Keystore, so the
// sign-out fallback has to clear it there, not in the WebView's localStorage.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { removeItem } = vi.hoisted(() => ({ removeItem: vi.fn() }));

vi.mock('../native', () => ({ isNativeApp: () => true }));
vi.mock('../secureSessionStorage', () => ({
  secureSessionStorage: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem,
  },
}));

import { AUTH_STORAGE_KEY, removeStoredSession } from '../supabase';

describe('removeStoredSession in the phone app', () => {
  beforeEach(() => {
    removeItem.mockReset();
    removeItem.mockResolvedValue(undefined);
  });

  it('should name the session key after the Supabase project host', () => {
    expect(AUTH_STORAGE_KEY).toBe('sb-localhost-auth-token');
  });

  it('should remove the session and its PKCE verifier from secure storage', async () => {
    await removeStoredSession();

    expect(removeItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY);
    expect(removeItem).toHaveBeenCalledWith(`${AUTH_STORAGE_KEY}-code-verifier`);
  });

  it('should not touch the WebView localStorage', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, 'not-the-native-session');

    await removeStoredSession();

    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBe('not-the-native-session');
    localStorage.removeItem(AUTH_STORAGE_KEY);
  });
});
