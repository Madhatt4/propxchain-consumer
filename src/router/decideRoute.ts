// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Post-login routing decision.
 *
 * Pure function: no side effects, no I/O. Everyone who is signed in and
 * verified lands on the same dashboard (in the phone app, its home screen at
 * /app). An agent's or developer's own pages (listings and pipeline, builder
 * sites) are extra items in that dashboard's side menu, not separate front
 * doors. A conveyancer is the exception: their work is matters, not their own
 * deals, so they land in the conveyancer workspace at /pro/conveyancer, with
 * the shared dashboard one menu item away.
 */

import type { PortalKind } from '@/components/navigation/portalSections';

export const CONVEYANCER_WORKSPACE_PATH = '/pro/conveyancer';

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
  /** True inside the iOS or Android app, whose signed-in home is the phone screen. */
  native?: boolean;
  /** The professional portals this user has (usePortalKinds); empty for a consumer. */
  portalKinds?: readonly PortalKind[];
}

export interface RouteDecision {
  path: string;
  reason: string;
}

export function decideRoute(args: DecideRouteArgs): RouteDecision {
  const { user, emailVerified, freshSignup, native = false, portalKinds = [] } = args;

  if (!user) {
    return { path: '/login', reason: 'no authenticated user' };
  }

  if (!emailVerified) {
    return { path: '/verify', reason: 'email not verified' };
  }

  if (freshSignup) {
    return { path: '/onboarding', reason: 'fresh signup flow' };
  }

  if (native) {
    return { path: '/app', reason: 'signed in: phone app home' };
  }

  // An agent who is also a conveyancer is an agent first (same rule as the
  // shared dashboard's isConveyancer), so only a pure conveyancer lands here.
  if (portalKinds.includes('conveyancer') && !portalKinds.includes('agent')) {
    return { path: CONVEYANCER_WORKSPACE_PATH, reason: 'signed in: conveyancer workspace' };
  }

  return { path: '/dashboard', reason: 'signed in: shared dashboard' };
}
