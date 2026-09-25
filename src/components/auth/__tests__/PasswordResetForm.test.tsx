import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PasswordResetForm from '../PasswordResetForm';

const mockResetPassword = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../../services/supabase.auth.service', () => ({
  supabaseAuthService: {
    resetPassword: (...args: unknown[]) => mockResetPassword(...args),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function setup(): void {
  render(
    <MemoryRouter>
      <PasswordResetForm />
    </MemoryRouter>,
  );
}

function submitEmail(email = 'marc@propxchain.com'): void {
  fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
}

describe('PasswordResetForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send the reset email and confirm to the address given', async () => {
    mockResetPassword.mockResolvedValue({ error: null });
    setup();
    submitEmail();

    expect(await screen.findByText(/Check your email/)).toBeInTheDocument();
    expect(screen.getByText('marc@propxchain.com')).toBeInTheDocument();
    expect(mockResetPassword).toHaveBeenCalledWith('marc@propxchain.com');
  });

  it('should surface the failure rather than claiming the email was sent', async () => {
    // The old version threw and caught its own error, which worked, but a
    // silent success here would leave the user waiting for an email that is
    // never coming.
    mockResetPassword.mockResolvedValue({ error: { message: 'Email rate limit exceeded' } });
    setup();
    submitEmail();

    expect(await screen.findByRole('alert')).toHaveTextContent('Email rate limit exceeded');
    expect(screen.queryByText(/Check your email/)).not.toBeInTheDocument();
  });

  it('should report a thrown network error without claiming success', async () => {
    mockResetPassword.mockRejectedValue(new Error('network down'));
    setup();
    submitEmail();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(/Check your email/)).not.toBeInTheDocument();
  });

  it('should let the user return to the form to send it again', async () => {
    mockResetPassword.mockResolvedValue({ error: null });
    setup();
    submitEmail();

    fireEvent.click(await screen.findByRole('button', { name: 'Send it again' }));

    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeInTheDocument();
    // The address is kept, so "send it again" does not mean "retype it".
    expect(screen.getByLabelText(/Email address/)).toHaveValue('marc@propxchain.com');
  });

  it('should navigate back to sign in through the router, not a page reload', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'));
  });

  it('should move focus to the confirmation heading for screen readers', async () => {
    // The entire pane swaps on success; without this a screen reader user
    // gets no announcement that anything happened.
    mockResetPassword.mockResolvedValue({ error: null });
    setup();
    submitEmail();

    const heading = await screen.findByRole('heading', { name: /Check your email/ });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it('should re-enable the submit button after a failure so the user can retry', async () => {
    mockResetPassword.mockResolvedValue({ error: { message: 'nope' } });
    setup();
    submitEmail();

    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Send reset link' })).not.toBeDisabled();
  });
});
