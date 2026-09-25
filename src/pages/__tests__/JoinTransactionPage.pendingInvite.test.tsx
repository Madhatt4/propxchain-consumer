// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../components/TransactionInvite', () => ({
  default: () => <div>TransactionInvite</div>,
}));

let mockIsAuthenticated = false;
vi.mock('../../stores/authStore', () => ({
  useIsAuthenticated: (): boolean => mockIsAuthenticated,
}));

import JoinTransactionPage from '../JoinTransactionPage';
import { useLocation } from 'react-router-dom';

function RegisterProbe(): JSX.Element {
  const { search } = useLocation();
  return <div data-testid="register">{search}</div>;
}
import { PENDING_INVITE_URL_KEY } from '@/utils/pendingInviteUrl';

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/join/:id" element={<JoinTransactionPage />} />
        <Route path="/login" element={<div>LOGIN</div>} />
        <Route path="/register" element={<RegisterProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  mockIsAuthenticated = false;
});

describe('JoinTransactionPage - logged-out redirect', () => {
  it('should store the full invite path + query string before redirecting to login', async () => {
    renderAt('/join/TX-1234-ABCD?role=seller&side=seller&by=aaa');

    await waitFor(() =>
      expect(localStorage.getItem(PENDING_INVITE_URL_KEY)).toBe(
        '/join/TX-1234-ABCD?role=seller&side=seller&by=aaa'
      )
    );
    // Legacy key kept for back-compat.
    expect(localStorage.getItem('pendingInviteCode')).toBe('TX-1234-ABCD');
  });

  it('should send a logged-out invitee to registration with the invite code and role', async () => {
    renderAt('/join/TX-1234-ABCD?role=seller&side=seller&by=aaa');

    const register = await screen.findByTestId('register');
    expect(register).toHaveTextContent('?invite=TX-1234-ABCD&role=seller');
  });

  it('should send a logged-out invitee without a role to registration with just the code', async () => {
    renderAt('/join/TX-1234-ABCD');

    const register = await screen.findByTestId('register');
    expect(register).toHaveTextContent('?invite=TX-1234-ABCD');
    expect(register).not.toHaveTextContent('role=');
  });
});
