import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import JoinAuthPanel from '../JoinAuthPanel';

const mockSignUp = vi.fn();
const mockResetPassword = vi.fn();
const mockLoginWithEmail = vi.fn();
const mockStash = vi.fn();

let storeError: string | null = null;

vi.mock('../../../services/supabase.auth.service', () => ({
  supabaseAuthService: {
    signUp: (...args: unknown[]) => mockSignUp(...args),
    resetPassword: (...args: unknown[]) => mockResetPassword(...args),
  },
}));

vi.mock('../../../services/conveyancerJoin.service', () => ({
  conveyancerJoinService: {
    stashPendingJoinCode: (...args: unknown[]) => mockStash(...args),
  },
}));

vi.mock('../../../stores/authStore', () => {
  const useAuthStore = (selector: (s: unknown) => unknown): unknown =>
    selector({ loginWithEmail: mockLoginWithEmail });
  useAuthStore.getState = (): { error: string | null } => ({ error: storeError });
  return { useAuthStore };
});

const CODE = 'a'.repeat(64);

function setup(): { onAuthenticated: ReturnType<typeof vi.fn>; onAwaiting: ReturnType<typeof vi.fn> } {
  const onAuthenticated = vi.fn();
  const onAwaiting = vi.fn();
  render(
    <JoinAuthPanel
      code={CODE}
      firmName="Wilson & Co"
      onAwaitingVerification={onAwaiting}
      onAuthenticated={onAuthenticated}
    />,
  );
  return { onAuthenticated, onAwaiting };
}

function fillCredentials(email = 'conveyancer@example.com', password = 'correct-horse'): void {
  fireEvent.change(screen.getByLabelText(/Work email address/), { target: { value: email } });
  const pw = screen.queryByLabelText(/^Password$/);
  if (pw) fireEvent.change(pw, { target: { value: password } });
}

describe('JoinAuthPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeError = null;
  });

  it('should default to the sign-up mode', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Create account & join' })).toBeInTheDocument();
  });

  it('should reject a password under 8 characters before calling the service', async () => {
    setup();
    fillCredentials('conveyancer@example.com', 'short');
    fireEvent.click(screen.getByRole('button', { name: 'Create account & join' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 8 characters/i);
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('should stash the code and await verification on a successful sign-up', async () => {
    mockSignUp.mockResolvedValue({ error: null });
    const { onAwaiting } = setup();
    fillCredentials();
    fireEvent.click(screen.getByRole('button', { name: 'Create account & join' }));

    await waitFor(() => expect(onAwaiting).toHaveBeenCalledWith('conveyancer@example.com'));
    expect(mockStash).toHaveBeenCalledWith(CODE);
  });

  // The bug this component exists to fix. Before, the user was shown the
  // "account already exists" text and given no control to act on it.
  describe('when the firm already has an account', () => {
    beforeEach(() => {
      mockSignUp.mockResolvedValue({
        error: { status: 422, message: 'An account with this email already exists.' },
      });
    });

    it('should offer sign-in and forgot-password as real controls', async () => {
      setup();
      fillCredentials();
      fireEvent.click(screen.getByRole('button', { name: 'Create account & join' }));

      expect(await screen.findByRole('button', { name: 'Sign in instead' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Forgot password?' })).toBeInTheDocument();
    });

    it('should keep the typed email when switching to sign-in', async () => {
      setup();
      fillCredentials();
      fireEvent.click(screen.getByRole('button', { name: 'Create account & join' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Sign in instead' }));

      expect(screen.getByLabelText(/Work email address/)).toHaveValue('conveyancer@example.com');
      expect(screen.getByRole('button', { name: 'Sign in & join' })).toBeInTheDocument();
    });

    it('should detect the case from the message when no 422 status is present', async () => {
      mockSignUp.mockResolvedValue({ error: { message: 'An account with this email already exists.' } });
      setup();
      fillCredentials();
      fireEvent.click(screen.getByRole('button', { name: 'Create account & join' }));

      expect(await screen.findByRole('button', { name: 'Sign in instead' })).toBeInTheDocument();
    });
  });

  describe('sign-in mode', () => {
    it('should stash the code and redeem in place on success', async () => {
      mockLoginWithEmail.mockResolvedValue(true);
      const { onAuthenticated } = setup();
      fireEvent.click(screen.getByRole('button', { name: /Already have an account/ }));
      fillCredentials();
      fireEvent.click(screen.getByRole('button', { name: 'Sign in & join' }));

      await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
      // Stashed BEFORE authenticating, so a mid-login route change can't
      // strand the invitation.
      expect(mockStash).toHaveBeenCalledWith(CODE);
    });

    it('should surface the store error and stay put on a failed sign-in', async () => {
      mockLoginWithEmail.mockResolvedValue(false);
      storeError = 'Invalid login credentials';
      const { onAuthenticated } = setup();
      fireEvent.click(screen.getByRole('button', { name: /Already have an account/ }));
      fillCredentials();
      fireEvent.click(screen.getByRole('button', { name: 'Sign in & join' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials');
      expect(onAuthenticated).not.toHaveBeenCalled();
    });
  });

  describe('reset mode', () => {
    it('should send a reset link and confirm, without asking for a password', async () => {
      mockResetPassword.mockResolvedValue({ error: null });
      setup();
      fireEvent.click(screen.getByRole('button', { name: /Already have an account/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));

      expect(screen.queryByLabelText(/^Password$/)).not.toBeInTheDocument();
      fillCredentials();
      fireEvent.click(screen.getByRole('button', { name: 'Email me a reset link' }));

      expect(await screen.findByText(/Reset link sent to/)).toBeInTheDocument();
      expect(mockResetPassword).toHaveBeenCalledWith('conveyancer@example.com');
      // The invitation has to survive the trip through the reset email.
      expect(mockStash).toHaveBeenCalledWith(CODE);
    });

    it('should report a reset failure rather than claiming the email was sent', async () => {
      mockResetPassword.mockResolvedValue({ error: { message: 'Email rate limit exceeded' } });
      setup();
      fireEvent.click(screen.getByRole('button', { name: /Already have an account/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
      fillCredentials();
      fireEvent.click(screen.getByRole('button', { name: 'Email me a reset link' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Email rate limit exceeded');
      expect(screen.queryByText(/Reset link sent to/)).not.toBeInTheDocument();
    });
  });
});
