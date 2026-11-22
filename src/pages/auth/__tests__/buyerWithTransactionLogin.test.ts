// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../../../stores/authStore';
import { getPostLoginRoute } from '../postLoginRoute';
import { decideRoute } from '../../../router/decideRoute';
import { decideRoleSelection } from '../../dashboard/onboardingRedirect';

const buyerMetadata = { role: 'buyer', propxchain_needs_onboarding: true };

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({
    orgJustCreated: false,
    principalId: 'principal-test',
    authMethod: 'supabase',
    supabaseUser: { id: 'user-1', user_metadata: buyerMetadata } as never,
  });
});

describe('login for a buyer with a transaction and no onboarded flag', () => {
  it('should end on the dashboard', () => {
    const loginRoute = getPostLoginRoute();
    const gateRoute = decideRoute({ user: { id: 'user-1' }, emailVerified: true, freshSignup: false });
    const dashboardDecision = decideRoleSelection({
      adminLoading: false,
      adminError: false,
      isAdmin: false,
      txLoading: false,
      txError: null,
      txCount: 1,
      metadata: buyerMetadata,
      authMethod: 'supabase',
    });

    expect(loginRoute).toBe('/post-login');
    expect(gateRoute.path).toBe('/dashboard');
    expect(dashboardDecision).toBe('stay');
  });
});
