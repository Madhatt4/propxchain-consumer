import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { isNativeApp } from './native';
import { secureSessionStorage } from './secureSessionStorage';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — check your .env.local');
}

// Where supabase-js keeps the signed-in session. This is the library's own
// default, pinned here so sign-out can clear it by name (removeStoredSession)
// and a library upgrade cannot move it and sign every user out.
export const AUTH_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storageKey: AUTH_STORAGE_KEY,
    // In the phone app the session lives in the Keychain / Keystore, not localStorage.
    ...(isNativeApp() ? { storage: secureSessionStorage } : {}),
    detectSessionInUrl: true,
    // Security scan M6: under the default implicit flow supabase-js accepted a
    // session from #access_token in ANY URL, so a crafted link could sign a
    // victim into an attacker's account. PKCE only exchanges a ?code= this
    // browser started; auth emails carry a token_hash instead (auth-email-hook).
    flowType: 'pkce',
  },
});

/**
 * Forget the signed-in session on this device without asking the server.
 * supabase-js has no offline sign-out: it only drops the saved session once
 * the server confirms, so a failed request leaves the user signed in. Sign-out
 * falls back to this (supabase.auth.service signOut).
 */
export async function removeStoredSession(): Promise<void> {
  const storage = isNativeApp() ? secureSessionStorage : window.localStorage;
  await storage.removeItem(AUTH_STORAGE_KEY);
  await storage.removeItem(`${AUTH_STORAGE_KEY}-code-verifier`);
}
