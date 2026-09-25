// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../../../components/auth/AuthShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../../../components/auth/OAuthButtons', () => ({
  default: () => <div>OAuthButtons</div>,
}));

const mockAuthState = {
  registerWithEmail: vi.fn(),
  isLoading: false,
  error: null as string | null,
  clearError: vi.fn(),
  isAuthenticated: true,
};
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: Object.assign(() => mockAuthState, { getState: () => mockAuthState }),
  useIdentityError: () => null,
}));

import RegisterPage from '../RegisterPage';
import { PENDING_INVITE_URL_KEY } from '@/utils/pendingInviteUrl';

function JoinProbe(): JSX.Element {
  const { pathname, search } = useLocation();
  return <div data-testid="join">{pathname + search}</div>;
}

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/join/:id" element={<JoinProbe />} />
        <Route path="/dashboard" element={<div data-testid="dashboard" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('RegisterPage - authenticated invitee', () => {
  it('should return to the full stored invite URL, keeping side and inviter', async () => {
    localStorage.setItem(PENDING_INVITE_URL_KEY, '/join/TX-1234-ABCD?role=seller&side=seller&by=aaa');

    renderAt('/register?invite=TX-1234-ABCD&role=seller');

    expect(await screen.findByTestId('join')).toHaveTextContent('/join/TX-1234-ABCD?role=seller&side=seller&by=aaa');
  });

  it('should fall back to the bare invite code when nothing was stored', async () => {
    renderAt('/register?invite=TX-1234-ABCD&role=seller');

    expect(await screen.findByTestId('join')).toHaveTextContent('/join/TX-1234-ABCD');
  });
});
