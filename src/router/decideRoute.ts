// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Post-login routing decision for the developer platform.
 *
 * Pure function — no side effects, no I/O. Given a snapshot of the user's
 * auth + memberships + cookie + query params, returns the path to navigate
 * to along with a human-readable reason for logging/debugging.
 *
 * See task 1a.5 in the developer-platform plan (monorepo).
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
  memberships: OrganisationMembership[];
  cookie: { lastUsedRole?: string };
  queryParams: { role?: string };
  emailVerified: boolean;
  freshSignup: boolean;
  hasPendingDeveloperOrg: boolean;
  hasPendingEstateAgentOrg: boolean;
}

export interface RouteDecision {
  path: string;
  reason: string;
}

const hasMembershipOfType = (
  memberships: OrganisationMembership[],
  type: OrganisationType,
): boolean => memberships.some((m) => m.organisationType === type);

/**
 * Branches 4/5 (developer) and 4b/5b (estate agent): an explicit ?role=
 * query param or a remembered lastUsedRole cookie, each gated on the user
 * actually holding a membership of that type. Returns null when no
 * preference applies, so the caller falls through to the remaining branches.
 */
function preferredPortalRoute(
  memberships: OrganisationMembership[],
  cookie: DecideRouteArgs['cookie'],
  queryParams: DecideRouteArgs['queryParams'],
): RouteDecision | null {
  const hasDevMembership = hasMembershipOfType(memberships, 'developer');

  // 4. Explicit ?role=developer query param wins over cookie, but only if
  //    the user actually has a developer membership
  if (queryParams.role === 'developer' && hasDevMembership) {
    return {
      path: '/builder',
      reason: 'query param role=developer + dev membership',
    };
  }

  // 5. Cookie preference: last used developer role
  if (cookie.lastUsedRole === 'developer' && hasDevMembership) {
    return {
      path: '/builder',
      reason: 'cookie lastUsedRole=developer + dev membership',
    };
  }

  const hasEstateAgentMembership = hasMembershipOfType(memberships, 'agent');

  // 4b/5b. Explicit or remembered estate-agent preference, gated on membership
  if (queryParams.role === 'agent' && hasEstateAgentMembership) {
    return { path: '/estate-agent', reason: 'query param role=agent + agent membership' };
  }
  if (cookie.lastUsedRole === 'agent' && hasEstateAgentMembership) {
    return { path: '/estate-agent', reason: 'cookie lastUsedRole=agent + agent membership' };
  }

  return null;
}

export function decideRoute(args: DecideRouteArgs): RouteDecision {
  const {
    user,
    memberships,
    cookie,
    queryParams,
    emailVerified,
    freshSignup,
    hasPendingDeveloperOrg,
    hasPendingEstateAgentOrg,
  } = args;

  // 1. No user → login
  if (!user) {
    return { path: '/login', reason: 'no authenticated user' };
  }

  // 2. Email not verified → verify
  if (!emailVerified) {
    return { path: '/verify', reason: 'email not verified' };
  }

  // 3. Fresh signup → onboarding
  if (freshSignup) {
    return { path: '/onboarding', reason: 'fresh signup flow' };
  }

  // 4/5/4b/5b. Explicit or remembered role preference, gated on membership
  const preferred = preferredPortalRoute(memberships, cookie, queryParams);
  if (preferred) return preferred;

  // 6a. Pending developer org from registration → builder onboarding
  if (hasPendingDeveloperOrg) {
    return { path: '/builder', reason: 'pending developer org from registration' };
  }

  // 6c. Pending estate agent org from registration → agent portal
  if (hasPendingEstateAgentOrg) {
    return { path: '/estate-agent', reason: 'pending estate agent org from registration' };
  }

  // 6b. No memberships at all → consumer dashboard
  if (memberships.length === 0) {
    return { path: '/dashboard', reason: 'no memberships (consumer)' };
  }

  // 7/8. Exactly one membership → route by that org's type
  if (memberships.length === 1) {
    const only = memberships[0];
    if (only.organisationType === 'developer') {
      return { path: '/builder', reason: 'single developer membership' };
    }
    if (only.organisationType === 'solicitor_firm') {
      return { path: '/solicitor', reason: 'single solicitor_firm membership' };
    }
    if (only.organisationType === 'agent') {
      return { path: '/estate-agent', reason: 'single agent membership' };
    }
    // consumer single-membership → consumer dashboard
    return {
      path: '/dashboard',
      reason: `single ${only.organisationType} membership`,
    };
  }

  // 9. Multiple memberships → role picker
  return {
    path: '/role-picker',
    reason: 'multiple memberships, user must choose',
  };
}
