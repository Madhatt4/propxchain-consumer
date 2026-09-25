// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Admin principals loaded from environment variables.
 *
 * Configure via VITE_ADMIN_PRINCIPALS in .env (comma-separated).
 * Falls back to empty array if not set — no hardcoded principals.
 */
const envPrincipals = import.meta.env.VITE_ADMIN_PRINCIPALS ?? '';

export const ADMIN_PRINCIPALS: readonly string[] = Object.freeze(
  envPrincipals
    .split(',')
    .map((p: string) => p.trim())
    .filter((p: string) => p.length > 0)
);

export function isAdminPrincipal(principalId: string | null | undefined): boolean {
  if (!principalId) return false;
  return ADMIN_PRINCIPALS.includes(principalId);
}
