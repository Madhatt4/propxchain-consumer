// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

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
  isAuthenticated: false,
  isInitialized: true,
};
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: () => mockAuthState,
  useIdentityError: () => null,
}));

import LoginPage from '../LoginPage';

describe('LoginPage - password sign-in only', () => {
  it('should not offer an emailed sign-in link on the email form', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /email/i }));

    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByText(/sign-in link/i)).not.toBeInTheDocument();
  });
});
