// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

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
}));

// Admin status comes from the user_management canister via useIsAdmin.
const mockAdminState = { isAdmin: false, role: null as 'super' | 'regular' | null, isLoading: false };
vi.mock('../hooks/useIsAdmin', () => ({
  useIsAdmin: () => mockAdminState,
}));

import AuthGate from './AuthGate';

// ── helpers ───────────────────────────────────────────────────────────────
const renderAt = (initialPath: string = '/post-login') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/post-login" element={<AuthGate />} />
        <Route path="/dashboard" element={<div data-testid="at-dashboard" />} />
        <Route path="/verify" element={<div data-testid="at-verify" />} />
        <Route path="/onboarding" element={<div data-testid="at-onboarding" />} />
        <Route path="/login" element={<div data-testid="at-login" />} />
      </Routes>
    </MemoryRouter>,
  );

const resetMocks = (): void => {
  mockAuthState.supabaseUser = {
    id: 'user-1',
    email_confirmed_at: new Date().toISOString(),
  };
  mockAuthState.authMethod = 'supabase';
  mockAuthState.isInitialized = true;
  mockAuthState.isLoading = false;
  mockAdminState.isAdmin = false;
  mockAdminState.role = null;
  mockAdminState.isLoading = false;
};

// ── tests ─────────────────────────────────────────────────────────────────
describe('<AuthGate>', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('renders a spinner while auth is still loading', () => {
    mockAuthState.isLoading = true;
    const { container } = renderAt();
    expect(container.querySelector('.animate-spin')).toBeTruthy();
    expect(screen.queryByTestId('at-dashboard')).toBeNull();
  });

  it('navigates a verified user to the shared /dashboard', async () => {
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

  it('sends an unverified email to /verify', async () => {
    mockAuthState.supabaseUser = { id: 'user-1', email_confirmed_at: null };
    renderAt();
    await waitFor(() => {
      expect(screen.getByTestId('at-verify')).toBeInTheDocument();
    });
  });

  it('sends a fresh signup to /onboarding', async () => {
    renderAt('/post-login?fresh=1');
    await waitFor(() => {
      expect(screen.getByTestId('at-onboarding')).toBeInTheDocument();
    });
  });

  it('should send a canister admin to /dashboard even with an unverified email', async () => {
    // Arrange
    mockAuthState.supabaseUser = { id: 'user-1', email_confirmed_at: null };
    mockAdminState.isAdmin = true;
    mockAdminState.role = 'super';

    // Act
    renderAt();

    // Assert
    await waitFor(() => {
      expect(screen.getByTestId('at-dashboard')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('at-verify')).toBeNull();
  });

  it('should hold on the spinner until the canister admin answer arrives', () => {
    // Arrange: an unverified user whose admin status is still loading must not
    // be routed to /verify before we know whether they are an admin.
    mockAuthState.supabaseUser = { id: 'user-1', email_confirmed_at: null };
    mockAdminState.isLoading = true;

    // Act
    const { container } = renderAt();

    // Assert
    expect(container.querySelector('.animate-spin')).toBeTruthy();
    expect(screen.queryByTestId('at-verify')).toBeNull();
    expect(screen.queryByTestId('at-dashboard')).toBeNull();
  });

  it('sends a signed-out visitor to /login', async () => {
    mockAuthState.supabaseUser = null;
    renderAt();
    await waitFor(() => {
      expect(screen.getByTestId('at-login')).toBeInTheDocument();
    });
  });
});
