// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import {
  decideRoute,
  type DecideRouteArgs,
  type OrganisationMembership,
} from './decideRoute';

const baseArgs = (): DecideRouteArgs => ({
  user: { id: 'user-1' },
  memberships: [],
  cookie: {},
  queryParams: {},
  emailVerified: true,
  freshSignup: false,
  hasPendingDeveloperOrg: false,
  hasPendingEstateAgentOrg: false,
});

const membership = (
  type: OrganisationMembership['organisationType'],
  id = 'org-1',
): OrganisationMembership => ({
  organisationId: id,
  organisationType: type,
  role: 'admin',
});

describe('decideRoute', () => {
  it('branch 1: no user → /login', () => {
    const result = decideRoute({ ...baseArgs(), user: null });
    expect(result.path).toBe('/login');
  });

  it('branch 2: email not verified → /verify', () => {
    const result = decideRoute({ ...baseArgs(), emailVerified: false });
    expect(result.path).toBe('/verify');
  });

  it('branch 3: fresh signup → /onboarding', () => {
    const result = decideRoute({ ...baseArgs(), freshSignup: true });
    expect(result.path).toBe('/onboarding');
  });

  it('branch 4: ?role=developer with dev membership → /builder', () => {
    const result = decideRoute({
      ...baseArgs(),
      queryParams: { role: 'developer' },
      memberships: [membership('developer')],
    });
    expect(result.path).toBe('/builder');
    expect(result.reason).toMatch(/query param/);
  });

  it('branch 4 negative: ?role=developer without dev membership falls through', () => {
    const result = decideRoute({
      ...baseArgs(),
      queryParams: { role: 'developer' },
      memberships: [],
    });
    // No dev membership → query param ignored → 0 memberships → /dashboard
    expect(result.path).toBe('/dashboard');
  });

  it('branch 5: cookie lastUsedRole=developer with dev membership → /builder', () => {
    const result = decideRoute({
      ...baseArgs(),
      cookie: { lastUsedRole: 'developer' },
      memberships: [membership('developer'), membership('consumer', 'org-2')],
    });
    expect(result.path).toBe('/builder');
    expect(result.reason).toMatch(/cookie/);
  });

  it('branch 6: no memberships → /dashboard (consumer)', () => {
    const result = decideRoute({ ...baseArgs(), memberships: [] });
    expect(result.path).toBe('/dashboard');
  });

  it('branch 7: single developer membership → /builder', () => {
    const result = decideRoute({
      ...baseArgs(),
      memberships: [membership('developer')],
    });
    expect(result.path).toBe('/builder');
    expect(result.reason).toMatch(/single developer/);
  });

  it('branch 8: single solicitor_firm membership → /solicitor', () => {
    const result = decideRoute({
      ...baseArgs(),
      memberships: [membership('solicitor_firm')],
    });
    expect(result.path).toBe('/solicitor');
  });

  it('branch 9: multiple memberships → /role-picker', () => {
    const result = decideRoute({
      ...baseArgs(),
      memberships: [
        membership('developer'),
        membership('solicitor_firm', 'org-2'),
      ],
    });
    expect(result.path).toBe('/role-picker');
  });

  // Edge cases worth locking in
  it('edge: single consumer membership falls through to /dashboard', () => {
    const result = decideRoute({
      ...baseArgs(),
      memberships: [membership('consumer')],
    });
    expect(result.path).toBe('/dashboard');
  });

  it('branch 4b: ?role=agent with agent membership → /estate-agent', () => {
    const result = decideRoute({
      ...baseArgs(),
      queryParams: { role: 'agent' },
      memberships: [membership('agent'), membership('consumer', 'org-2')],
    });
    expect(result.path).toBe('/estate-agent');
  });

  it('branch 5b: cookie lastUsedRole=agent with agent membership → /estate-agent', () => {
    const result = decideRoute({
      ...baseArgs(),
      cookie: { lastUsedRole: 'agent' },
      memberships: [membership('agent'), membership('developer', 'org-2')],
    });
    expect(result.path).toBe('/estate-agent');
  });

  it('branch 6c: pending estate agent org → /estate-agent', () => {
    const result = decideRoute({ ...baseArgs(), hasPendingEstateAgentOrg: true });
    expect(result.path).toBe('/estate-agent');
    expect(result.reason).toMatch(/pending estate agent/);
  });

  it('branch 7b: single agent membership → /estate-agent', () => {
    const result = decideRoute({
      ...baseArgs(),
      memberships: [membership('agent')],
    });
    expect(result.path).toBe('/estate-agent');
  });

  it('order: no user beats fresh signup flag', () => {
    const result = decideRoute({
      ...baseArgs(),
      user: null,
      freshSignup: true,
    });
    expect(result.path).toBe('/login');
  });

  it('order: unverified beats fresh signup flag', () => {
    const result = decideRoute({
      ...baseArgs(),
      emailVerified: false,
      freshSignup: true,
    });
    expect(result.path).toBe('/verify');
  });

  it('order: fresh signup beats query param role', () => {
    const result = decideRoute({
      ...baseArgs(),
      freshSignup: true,
      queryParams: { role: 'developer' },
      memberships: [membership('developer')],
    });
    expect(result.path).toBe('/onboarding');
  });
});
