// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Post-login routing decision.
 *
 * Pure function: no side effects, no I/O. Everyone who is signed in and
 * verified lands on the same dashboard. A professional's own pages (agent
 * listings and pipeline, builder sites) are extra items in that dashboard's
 * side menu, not separate front doors, so there is nothing to choose between.
 */

export type OrganisationType =
  | 'consumer'
  | 'developer'
  | 'agent'
  | 'solicitor_firm';

export interface OrganisationMembership {
  organisationId: string;
  organisationType: OrganisationType;
  role: string;
}

export interface DecideRouteUser {
  id: string;
}

export interface DecideRouteArgs {
  user: DecideRouteUser | null;
  emailVerified: boolean;
  freshSignup: boolean;
}

export interface RouteDecision {
  path: string;
  reason: string;
}

export function decideRoute(args: DecideRouteArgs): RouteDecision {
  const { user, emailVerified, freshSignup } = args;

  if (!user) {
    return { path: '/login', reason: 'no authenticated user' };
  }

  if (!emailVerified) {
    return { path: '/verify', reason: 'email not verified' };
  }

  if (freshSignup) {
    return { path: '/onboarding', reason: 'fresh signup flow' };
  }

  return { path: '/dashboard', reason: 'signed in: shared dashboard' };
}
