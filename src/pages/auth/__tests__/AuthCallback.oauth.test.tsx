import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import {
  rememberOAuthSignUpIntent,
  consumeOAuthSignUpIntent,
} from '../../../utils/oauthSignUpIntent';

const mockExchange = vi.fn();
const mockGetSession = vi.fn();
const mockSetSession = vi.fn();
const mockVerifyOtp = vi.fn();
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: (c: string) => mockExchange(c),
      getSession: () => mockGetSession(),
      setSession: (a: unknown) => mockSetSession(a),
      verifyOtp: (a: unknown) => mockVerifyOtp(a),
    },
  },
}));

const mockCompleteOAuthLogin = vi.fn();
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: { getState: () => ({ completeOAuthLogin: mockCompleteOAuthLogin, error: null }) },
}));
vi.mock('../postLoginRoute', () => ({ getPostLoginRoute: () => '/dashboard' }));

import AuthCallback from '../AuthCallback';

const googleSession = { data: { session: { user: { app_metadata: { provider: 'google' } } } }, error: null };
const emailSession = { data: { session: { user: { app_metadata: { provider: 'email' } } } }, error: null };
const noSession = { data: { session: null }, error: null };

const renderAt = (search: string): void => {
  window.history.pushState({}, '', `/auth/callback${search}`);
  render(<MemoryRouter><AuthCallback /></MemoryRouter>);
};

beforeEach(() => {
  vi.clearAllMocks();
  mockExchange.mockResolvedValue(googleSession);
  mockGetSession.mockResolvedValue(noSession);
  mockSetSession.mockResolvedValue({ data: {}, error: null });
  mockVerifyOtp.mockResolvedValue({ data: {}, error: null });
  mockCompleteOAuthLogin.mockResolvedValue(true);
});

describe('AuthCallback OAuth branch', () => {
  it('should complete OAuth login and route to the post-login destination for a google return', async () => {
    mockExchange.mockResolvedValue(googleSession);
    mockGetSession.mockResolvedValue(googleSession);
    renderAt('?code=abc');
    await waitFor(() => expect(mockCompleteOAuthLogin).toHaveBeenCalled());
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true }));
  });

  it('should complete OAuth even when the code was already consumed by detectSessionInUrl (no code left in the URL)', async () => {
    // Reproduces the production bug: supabase-js auto-exchanged the OAuth code and
    // stripped it from the URL before this component mounted, so no code/fragment
    // is present — but a google session already exists. completeOAuthLogin must
    // still run (otherwise the ICP identity is never generated).
    mockGetSession.mockResolvedValue(googleSession);
    renderAt('');
    await waitFor(() => expect(mockCompleteOAuthLogin).toHaveBeenCalled());
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true }));
  });

  it('should run ICP identity setup and route to the post-login destination for a magic-link / email-verification return', async () => {
    // Regression for the dead-end bug: an email/magic-link session used to
    // skip completeOAuthLogin entirely and bounce to /login, leaving a
    // brand-new magic-link user authenticated with principal: null (unable
    // to join a transaction, which hard-requires principalId).
    mockExchange.mockResolvedValue(emailSession);
    mockGetSession.mockResolvedValue(emailSession);
    renderAt('?code=abc');
    await waitFor(() => expect(mockExchange).toHaveBeenCalled());
    await waitFor(() => expect(mockCompleteOAuthLogin).toHaveBeenCalled());
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true }));
  });

  it('should surface an error and not navigate when identity setup fails for a magic-link return', async () => {
    mockExchange.mockResolvedValue(emailSession);
    mockGetSession.mockResolvedValue(emailSession);
    mockCompleteOAuthLogin.mockResolvedValue(false);
    renderAt('?code=abc');
    await waitFor(() => expect(mockCompleteOAuthLogin).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/sign-in failed/i)).toBeInTheDocument());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should show an error and skip the code exchange when the provider returns an error', async () => {
    renderAt('?error=access_denied&error_description=User%20denied%20access');
    await waitFor(() => expect(screen.getByText(/user denied access/i)).toBeInTheDocument());
    expect(mockExchange).not.toHaveBeenCalled();
  });
});

/**
 * OAuth cannot refuse a duplicate the way signUp does: pressing "Continue with
 * Google" with an address that already has an account produces an ordinary
 * login, and the user is dropped wherever that account belongs having been
 * told nothing. Reported from production on 2026-09-03, when registering
 * landed on the Conveyancer portal because the address was already a
 * conveyancer account.
 */
describe('AuthCallback registration that turned out to be a sign-in', () => {
  const sessionFor = (createdAt: string) => ({
    data: { session: { user: { app_metadata: { provider: 'google' }, created_at: createdAt } } },
    error: null,
  });

  const oldAccount = sessionFor('2026-07-27T11:46:55.650687Z');
  const freshAccount = sessionFor(new Date().toISOString());

  beforeEach(() => {
    sessionStorage.clear();
  });

  it('should say it signed the user in when the account already existed', async () => {
    rememberOAuthSignUpIntent();
    mockExchange.mockResolvedValue(oldAccount);
    mockGetSession.mockResolvedValue(oldAccount);

    renderAt('?code=abc');

    await waitFor(() => expect(screen.getByText(/already have an account/i)).toBeInTheDocument());
    // Held, not routed: the whole point is that the user reads it first.
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should route on from that notice when the user continues', async () => {
    rememberOAuthSignUpIntent();
    mockExchange.mockResolvedValue(oldAccount);
    mockGetSession.mockResolvedValue(oldAccount);

    renderAt('?code=abc');
    await waitFor(() => expect(screen.getByText(/already have an account/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it('should stay out of the way when the registration really did create an account', async () => {
    rememberOAuthSignUpIntent();
    mockExchange.mockResolvedValue(freshAccount);
    mockGetSession.mockResolvedValue(freshAccount);

    renderAt('?code=abc');

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true }));
    expect(screen.queryByText(/already have an account/i)).toBeNull();
  });

  it('should stay out of the way when the user came from the sign-in page', async () => {
    // No intent recorded: signing in to an existing account is exactly what
    // was asked for, so there is nothing to explain.
    mockExchange.mockResolvedValue(oldAccount);
    mockGetSession.mockResolvedValue(oldAccount);

    renderAt('?code=abc');

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true }));
    expect(screen.queryByText(/already have an account/i)).toBeNull();
  });

  it('should not leave the intent behind for the next sign-in in this tab', async () => {
    rememberOAuthSignUpIntent();
    mockExchange.mockResolvedValue(freshAccount);
    mockGetSession.mockResolvedValue(freshAccount);

    renderAt('?code=abc');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());

    expect(consumeOAuthSignUpIntent()).toBe(false);
  });
});

describe('AuthCallback never takes a session from the URL fragment (security scan M6)', () => {
  it('should ignore #access_token / #refresh_token and not create a session from them', async () => {
    mockGetSession.mockResolvedValue(noSession);
    renderAt('#access_token=attacker&refresh_token=attacker&type=signup');
    await waitFor(() => expect(mockGetSession).toHaveBeenCalled());
    expect(mockSetSession).not.toHaveBeenCalled();
    expect(mockCompleteOAuthLogin).not.toHaveBeenCalled();
  });

  it('should exchange an email token_hash of an allowed type with verifyOtp', async () => {
    mockGetSession.mockResolvedValue(emailSession);
    renderAt('?token_hash=h1&type=magiclink');
    await waitFor(() => expect(mockVerifyOtp).toHaveBeenCalledWith({ token_hash: 'h1', type: 'magiclink' }));
  });

  it('should not pass an unknown type to verifyOtp', async () => {
    renderAt('?token_hash=h1&type=bogus');
    await waitFor(() => expect(mockGetSession).toHaveBeenCalled());
    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });
});
