// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Tiny cookie helpers for the post-login router. Deliberately no
 * third-party dep — the repo has no js-cookie and we don't want to
 * add one for four lines of logic.
 */

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  if (!match) return undefined;
  const value = match.slice(name.length + 1);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function writeCookie(
  name: string,
  value: string,
  maxAgeSeconds: number = ONE_YEAR_SECONDS,
): void {
  if (typeof document === 'undefined') return;
  const encoded = encodeURIComponent(value);
  document.cookie = `${name}=${encoded}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

export const LAST_USED_ROLE_COOKIE = 'lastUsedRole';
