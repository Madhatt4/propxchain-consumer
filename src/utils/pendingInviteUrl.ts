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

/**
 * Store a path + search string to return to after login. Only `/join...`
 * paths are accepted — this value is later fed straight into `navigate()`,
 * so anything else (an absolute URL, an unrelated in-app path) is rejected
 * to prevent it being used as an open-redirect vector via localStorage.
 */
export function storePendingInviteUrl(pathWithSearch: string): void {
  if (!pathWithSearch.startsWith('/join')) return;
  localStorage.setItem(PENDING_INVITE_URL_KEY, pathWithSearch);
}

/** Return the stored invite URL and clear it. Null when none is stored. */
export function consumePendingInviteUrl(): string | null {
  const value = localStorage.getItem(PENDING_INVITE_URL_KEY);
  if (value === null) return null;
  localStorage.removeItem(PENDING_INVITE_URL_KEY);
  return value;
}
