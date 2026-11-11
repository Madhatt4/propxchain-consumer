// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../OAuthButtons', () => ({
  default: () => <div>OAuthButtons</div>,
}));

const mockResend = vi.fn();
vi.mock('../../../services/supabase.auth.service', () => ({
  supabaseAuthService: {
    resendSignupConfirmation: (...args: unknown[]) => mockResend(...args),
  },
}));

const mockAuthState = {
  loginWithEmail: vi.fn(),
  loginWithII: vi.fn(),
  isLoading: false,
  error: null as string | null,
  errorCode: null as string | null,
  clearError: vi.fn(),
};
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: Object.assign(() => mockAuthState, { getState: () => mockAuthState }),
  useIdentityError: () => null,
}));

import LoginForm from '../LoginForm';

const EMAIL = 'unconfirmed@example.com';

function renderForm(): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <LoginForm onSuccess={vi.fn()} />
    </MemoryRouter>,
  );
}

/** Pick the email method and submit the form with EMAIL. */
async function signInWithEmail(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: /Continue with email/ }));
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: EMAIL } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password-123' } });
  fireEvent.click(screen.getByRole('button', { name: /^Sign in/ }));
  await waitFor(() => expect(mockAuthState.loginWithEmail).toHaveBeenCalled());
}

describe('LoginForm — email not confirmed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.error = null;
    mockAuthState.errorCode = null;
  });

  it('should offer to resend the confirmation to the email typed when sign-in says not confirmed', async () => {
    mockResend.mockResolvedValue({ error: null });
    const { rerender } = renderForm();
    mockAuthState.loginWithEmail.mockImplementation(async () => {
      mockAuthState.error = 'Email not confirmed';
      mockAuthState.errorCode = 'email_not_confirmed';
      return false;
    });

    await signInWithEmail();
    rerender(
      <MemoryRouter>
        <LoginForm onSuccess={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/You haven't confirmed your email yet/)).toBeInTheDocument();
    expect(screen.queryByText('Email not confirmed')).not.toBeInTheDocument();
    expect(screen.getByText(/Check your junk or spam folder/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Send it again/ }));
    await waitFor(() => expect(mockResend).toHaveBeenCalledWith(EMAIL));
  });

  it('should not offer a resend for other sign-in errors', async () => {
    const { rerender } = renderForm();
    mockAuthState.loginWithEmail.mockImplementation(async () => {
      mockAuthState.error = 'Invalid login credentials';
      mockAuthState.errorCode = 'invalid_credentials';
      return false;
    });

    await signInWithEmail();
    rerender(
      <MemoryRouter>
        <LoginForm onSuccess={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Invalid login credentials')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Send it again/ })).not.toBeInTheDocument();
  });
});
