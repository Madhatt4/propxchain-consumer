// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Remembers that an OAuth round-trip began on a register page, so the callback
 * can tell "you just created an account" apart from "you already had one and
 * we signed you in".
 *
 * Supabase cannot answer that on its own. `signInWithOAuth` returns no user —
 * it only redirects — and an address that already has an account comes back as
 * an ordinary `login` event with nothing marking it as an attempted
 * registration. The email/password path gets this for free, because `signUp`
 * returns an empty `identities` array for an existing address (see
 * supabase.auth.service.ts), which is why only the OAuth buttons need it.
 *
 * sessionStorage rather than a `redirectTo` query param: appending anything to
 * the callback URL risks missing Supabase's redirect allow-list, which fails by
 * silently bouncing the user to the Site URL. It is also per-tab, so a
 * forgotten flag cannot leak into a different tab's ordinary sign-in.
 */

export const OAUTH_SIGNUP_INTENT_KEY = 'propxchain_oauth_signup_intent';

/** Record that this OAuth redirect started from a register page. */
export function rememberOAuthSignUpIntent(): void {
  try {
    sessionStorage.setItem(OAUTH_SIGNUP_INTENT_KEY, '1');
  } catch {
    // Private browsing, or storage disabled. The notice is a courtesy, never a
    // gate — losing it degrades to the silent sign-in we had before.
  }
}

/** Drop the flag without reading it, e.g. when the redirect never happened. */
export function clearOAuthSignUpIntent(): void {
  try {
    sessionStorage.removeItem(OAUTH_SIGNUP_INTENT_KEY);
  } catch {
    // As above — nothing depends on this succeeding.
  }
}

/**
 * True when this callback began as a registration attempt. Always clears the
 * flag, so a later sign-in in the same tab is never mistaken for a sign-up.
 */
export function consumeOAuthSignUpIntent(): boolean {
  let value: string | null = null;
  try {
    value = sessionStorage.getItem(OAUTH_SIGNUP_INTENT_KEY);
  } catch {
    return false;
  }
  clearOAuthSignUpIntent();
  return value !== null;
}
