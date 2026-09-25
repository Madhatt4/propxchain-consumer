// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type {
  OrganisationMembership,
  OrganisationType,
} from './decideRoute';

// ── mocks ─────────────────────────────────────────────────────────────────
const mockAuthState = {
  supabaseUser: { id: 'user-1', email_confirmed_at: new Date().toISOString() } as
    | { id: string; email_confirmed_at: string | null }
    | null,
  authMethod: 'supabase' as 'supabase' | 'ii' | null,
  isInitialized: true,
  isLoading: false,
};

vi.mock('../stores/authStore', () => ({
  useAuthStore: <T,>(selector: (s: typeof mockAuthState) => T): T =>
    selector(mockAuthState),
  // AuthGate's admin escape hatch reads usePrincipalId() (added in the admin
  // escape-hatch change). null → isAdminPrincipal(null) is false, so these
  // tests exercise the normal non-admin decideRoute path.
  usePrincipalId: (): string | null => null,
}));

type MembershipsQueryState = {
  data: OrganisationMembership[] | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: () => void;
};

let mockMembershipsState: MembershipsQueryState = {
  data: [],
  isLoading: false,
  isFetching: false,
  isError: false,
  refetch: vi.fn(),
};

vi.mock('./useMembershipsQuery', () => ({
  useMembershipsQuery: () => mockMembershipsState,
}));

import AuthGate from './AuthGate';

// ── helpers ───────────────────────────────────────────────────────────────
const renderAt = (initialPath: string = '/post-login') => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/post-login" element={<AuthGate />} />
          <Route
            path="/dashboard"
            element={<div data-testid="at-dashboard" />}
          />
          <Route
            path="/builder"
            element={<div data-testid="at-builder" />}
          />
          <Route
            path="/role-picker"
            element={<div data-testid="at-role-picker" />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const membership = (
  type: OrganisationType,
  id = 'org-1',
): OrganisationMembership => ({
  organisationId: id,
  organisationType: type,
  role: 'admin',
});

const resetMocks = (): void => {
  mockAuthState.supabaseUser = {
    id: 'user-1',
    email_confirmed_at: new Date().toISOString(),
  };
  mockAuthState.authMethod = 'supabase';
  mockAuthState.isInitialized = true;
  mockAuthState.isLoading = false;
  mockMembershipsState = {
    data: [],
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  };
};

// ── tests ─────────────────────────────────────────────────────────────────
describe('<AuthGate>', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('renders a spinner while memberships are loading', () => {
    mockMembershipsState = {
      ...mockMembershipsState,
      isLoading: true,
    };
    const { container } = renderAt();
    expect(container.querySelector('.animate-spin')).toBeTruthy();
    expect(screen.queryByTestId('at-dashboard')).toBeNull();
  });

  it('navigates to /dashboard when the user has no memberships', async () => {
    mockMembershipsState = { ...mockMembershipsState, data: [] };
    renderAt();
    await waitFor(() => {
      expect(screen.getByTestId('at-dashboard')).toBeInTheDocument();
    });
  });

  it('navigates an Internet Identity user to /dashboard even with no Supabase session', async () => {
    // II users authenticate canister-side only — no supabaseUser, so the
    // decideRoute path would otherwise bounce them to /login.
    mockAuthState.authMethod = 'ii';
    mockAuthState.supabaseUser = null;
    renderAt();
    await waitFor(() => {
      expect(screen.getByTestId('at-dashboard')).toBeInTheDocument();
    });
  });

  it('navigates to /builder when the user has a single developer membership', async () => {
    mockMembershipsState = {
      ...mockMembershipsState,
      data: [membership('developer')],
    };
    renderAt();
    await waitFor(() => {
      expect(screen.getByTestId('at-builder')).toBeInTheDocument();
    });
  });

  it('navigates to /role-picker when the user has multiple memberships', async () => {
    mockMembershipsState = {
      ...mockMembershipsState,
      data: [membership('developer'), membership('solicitor_firm', 'org-2')],
    };
    renderAt();
    await waitFor(() => {
      expect(screen.getByTestId('at-role-picker')).toBeInTheDocument();
    });
  });

  it('renders the error fallback when the memberships query errors', () => {
    mockMembershipsState = {
      ...mockMembershipsState,
      isError: true,
    };
    renderAt();
    expect(
      screen.getByText(/Failed to load your accounts/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
