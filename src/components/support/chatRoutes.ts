// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Where the floating help button belongs. Its own module so the widget file
 * exports nothing but a component, which is what keeps fast refresh working.
 *
 * The rule is "every signed-in page, except the few where help is the wrong
 * thing to offer". It used to be the opposite — a short list of pages that
 * got the button — and that list quietly left out every portal built after
 * it: conveyancers, estate agents and developers had no way to raise a
 * ticket. A deny list fails the other way: a new page gets help by default.
 *
 * `routeClassification.test.ts` reads the route table in `App.tsx` and fails
 * if a public route is missing from this list, so a new marketing page cannot
 * sprout a help button by accident either.
 */

/**
 * Pages without the button. Matched as whole path segments, so `/support`
 * does not also swallow a hypothetical `/supporting`.
 *
 * - Public pages: marketing, resources, shared packs and listings, and the
 *   sign-in and registration screens. Help there is the public contact form.
 * - Onboarding and role picking: a short, guided flow with its own copy.
 * - Admin: the people answering tickets do not raise them from the console.
 */
export const NO_HELP_PREFIXES: readonly string[] = [
  // Public
  '/features',
  '/how-it-works',
  '/sell-my-house',
  '/find-a-conveyancer',
  '/about',
  '/terms',
  '/privacy',
  '/compliance',
  '/support',
  '/sales',
  '/partners',
  '/pricing',
  '/developers',
  '/sellers',
  '/buyers',
  '/conveyancers',
  '/solicitors',
  '/faq',
  '/resources',
  '/guides',
  '/pack',
  '/proof',
  '/property',
  '/api',
  '/login',
  '/register',
  '/conveyancer/join',
  '/auth',
  '/reset-password',
  '/forgot-password',
  '/quote',
  '/payment',
  '/seller-fee',
  '/wizard',
  // Guided flows
  '/post-login',
  '/role-picker',
  '/onboarding',
  // Staff
  '/admin',
];

function underPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Whether the help button belongs on this route for a signed-in user. */
export function isHelpRoute(pathname: string): boolean {
  if (pathname === '/' || pathname === '') return false;
  return !NO_HELP_PREFIXES.some((prefix) => underPrefix(pathname, prefix));
}
