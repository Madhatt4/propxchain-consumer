// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Where the floating help button belongs. Its own module so the widget file
 * exports nothing but a component, which is what keeps fast refresh working.
 */

/**
 * The dashboard and everything under it, plus the transaction pages: a mover
 * stuck on a stage is exactly who needs help. Marketing pages and the auth
 * screens stay out: help belongs where someone is signed in and working.
 */
export function isDashboardPath(pathname: string): boolean {
  return (
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/transaction-dashboard' ||
    pathname.startsWith('/transaction/')
  );
}
