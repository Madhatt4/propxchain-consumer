// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Preserves the full invite URL (path + query string, e.g. role/side/by/rm
 * params) across the logged-out -> /login -> post-login redirect, so a
 * buyer or seller who follows an invite link while signed out lands back on
 * the exact invite they clicked instead of a generic dashboard.
 *
 * Deliberately separate from the legacy `pendingInviteCode` key
 * (JoinTransactionPage still writes both for back-compat): that key only
 * carries the bare invite code and drops role/side/by/rm context.
 */

export const PENDING_INVITE_URL_KEY = 'propxchain_pending_invite_url';

/** A seller's invitation to their estate agent: exactly one 64-hex code, nothing after it. */
const AGENT_JOIN_PATH = /^\/agent\/join\/[0-9a-f]{64}$/;
export const PENDING_AGENT_INVITE_KEY = 'propxchain_pending_agent_invite';
/** Long enough to verify an email and sign in; short enough that a shared browser does not keep it for the next person. */
export const AGENT_INVITE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Store a path + search string to return to after login. Only `/join...`
 * paths and the estate agent invitation path `/agent/join/<code>` are
 * accepted — this value is later fed straight into `navigate()`, so anything
 * else (an absolute URL, an unrelated in-app path) is rejected to prevent it
 * being used as an open-redirect vector via localStorage.
 *
 * The agent path is what carries a seller's invitation through estate agent
 * sign-up and email verification: the first sign-in afterwards lands back on
 * the invitation, where the agent still has to press Accept. It is kept for
 * 24 hours only, under its own key, and is never accepted automatically.
 */
export function storePendingInviteUrl(pathWithSearch: string): void {
  if (AGENT_JOIN_PATH.test(pathWithSearch)) {
    localStorage.setItem(PENDING_AGENT_INVITE_KEY, JSON.stringify({ path: pathWithSearch, expiresAt: Date.now() + AGENT_INVITE_TTL_MS }));
    return;
  }
  if (!pathWithSearch.startsWith('/join')) return;
  localStorage.setItem(PENDING_INVITE_URL_KEY, pathWithSearch);
}

/** The stored agent invitation if it is well-formed and in date; always cleared once read. */
function consumeAgentInvite(): string | null {
  const raw = localStorage.getItem(PENDING_AGENT_INVITE_KEY);
  if (raw === null) return null;
  localStorage.removeItem(PENDING_AGENT_INVITE_KEY);
  try {
    const { path, expiresAt } = JSON.parse(raw) as { path?: unknown; expiresAt?: unknown };
    if (typeof path !== 'string' || !AGENT_JOIN_PATH.test(path)) return null;
    if (typeof expiresAt !== 'number' || expiresAt <= Date.now()) return null;
    return path;
  } catch {
    return null;
  }
}

/** Return the stored invite URL and clear it. Null when none is stored. */
export function consumePendingInviteUrl(): string | null {
  const value = localStorage.getItem(PENDING_INVITE_URL_KEY);
  if (value === null) return consumeAgentInvite();
  localStorage.removeItem(PENDING_INVITE_URL_KEY);
  return value;
}
