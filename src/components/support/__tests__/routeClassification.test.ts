// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Every top-level route in `App.tsx` is either behind `ProtectedRoute` or it is
 * not, and that decides whether the help button belongs on it:
 *
 * - a public route must be on the no-help list, or a signed-in visitor reading
 *   the pricing page would get a support chat about a move they are not in;
 * - a protected route must NOT be on it, except the guided flows and admin,
 *   or a new portal ships with no way to ask for help — which is how the
 *   conveyancer, estate-agent and developer portals went without it.
 *
 * Static analysis of the route table rather than booting the router, the same
 * approach as `marketingRouteParity.test.ts`: the contract is that two files
 * agree, and rendering App would test React more than the contract.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { isHelpRoute } from '../chatRoutes';

const here = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(resolve(here, '../../../App.tsx'), 'utf8');

/** Protected routes that deliberately go without help. */
const PROTECTED_WITHOUT_HELP = ['/post-login', '/role-picker', '/onboarding', '/admin'];

interface TopLevelRoute {
  path: string;
  isProtected: boolean;
}

/** `<Route path="/…" element={…}` lines; nested children use relative paths. */
function topLevelRoutes(): TopLevelRoute[] {
  return [...app.matchAll(/<Route path="(\/[^"]*)" element=\{(.*)$/gm)].map((m) => ({
    path: m[1],
    isProtected: m[2].includes('<ProtectedRoute>'),
  }));
}

/** A concrete URL for a route pattern, so `:id` segments can be tested. */
function sample(path: string): string {
  return path.replace(/:[A-Za-z]+/g, 'x');
}

describe('help button route classification', () => {
  const routes = topLevelRoutes();

  it('should find the route table', () => {
    expect(routes.length).toBeGreaterThan(40);
  });

  it('should keep the help button off every public route', () => {
    const leaking = routes.filter((r) => !r.isProtected && isHelpRoute(sample(r.path))).map((r) => r.path);
    expect(leaking).toEqual([]);
  });

  it('should put the help button on every signed-in route bar the guided flows and admin', () => {
    const missing = routes
      .filter((r) => r.isProtected)
      .filter((r) => !PROTECTED_WITHOUT_HELP.some((p) => r.path === p || r.path.startsWith(`${p}/`)))
      .filter((r) => !isHelpRoute(sample(r.path)))
      .map((r) => r.path);
    expect(missing).toEqual([]);
  });
});
