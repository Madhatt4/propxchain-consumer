// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../../../components/auth/AuthShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../../../components/auth/OAuthButtons', () => ({
  default: () => <div>OAuthButtons</div>,
}));

const mockAuthState = {
  loginWithEmail: vi.fn(),
  loginWithII: vi.fn(),
  isLoading: false,
  error: null as string | null,
  clearError: vi.fn(),
  isAuthenticated: true,
  isInitialized: true,
};
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: () => mockAuthState,
  useIdentityError: () => null,
}));

import { storePendingInviteUrl } from '../../../utils/pendingInviteUrl';
import LoginPage from '../LoginPage';

function renderLoginPage(): void {
  // React.StrictMode double-invokes effects in dev — this reproduces the
  // double-fire that let the second getPostLoginRoute() call clobber the
  // first navigate() with the fallback route.
  render(
    <React.StrictMode>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/join/:id" element={<div>JOIN PAGE</div>} />
          <Route path="/post-login" element={<div>POST LOGIN</div>} />
        </Routes>
      </MemoryRouter>
    </React.StrictMode>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('LoginPage - already-authenticated effect under StrictMode', () => {
  it('should navigate to the pending invite URL exactly once, not fall back to the ordinary route', async () => {
    storePendingInviteUrl('/join/TX-1234-ABCD?role=seller&side=seller&by=aaa');

    renderLoginPage();

    await waitFor(() => expect(screen.queryByText('JOIN PAGE')).toBeTruthy());
    // A second, StrictMode-induced invocation must not have re-consumed
    // the (already-cleared) pending URL and landed on the fallback route.
    expect(screen.queryByText('POST LOGIN')).toBeNull();
  });
});
