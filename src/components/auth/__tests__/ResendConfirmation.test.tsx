// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { AuthError } from '@supabase/supabase-js';

const mockResend = vi.fn();
vi.mock('../../../services/supabase.auth.service', () => ({
  supabaseAuthService: {
    resendSignupConfirmation: (...args: unknown[]) => mockResend(...args),
  },
}));

import ResendConfirmation from '../ResendConfirmation';
import {
  classifyResendError,
  RESEND_COOLDOWN_SECONDS,
  RESEND_NETWORK_MESSAGE,
  RESEND_RATE_LIMITED_MESSAGE,
  RESEND_SENT_MESSAGE,
} from '../../../lib/resendConfirmation';

const EMAIL = 'new.user@example.com';

function authError(fields: Partial<AuthError>): AuthError {
  return Object.assign(new Error(fields.message ?? 'error'), fields) as AuthError;
}

/** Click the button and let the awaited resend settle. */
async function clickSend(): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Send it again/ }));
  });
}

describe('ResendConfirmation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockResend.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should tell the user to check junk or spam and name the sender', () => {
    render(<ResendConfirmation email={EMAIL} />);

    expect(
      screen.getByText(/Can't see it\? Check your junk or spam folder\. It comes from PropXchain \(noreply@propxchain\.com\)/),
    ).toBeInTheDocument();
  });

  it('should resend a signup confirmation to the given email', async () => {
    mockResend.mockResolvedValue({ error: null });
    render(<ResendConfirmation email={EMAIL} />);

    await clickSend();

    expect(mockResend).toHaveBeenCalledTimes(1);
    expect(mockResend).toHaveBeenCalledWith(EMAIL);
    expect(screen.getByRole('status')).toHaveTextContent(RESEND_SENT_MESSAGE);
  });

  it('should disable the button with a countdown, then re-enable it after the cooldown', async () => {
    mockResend.mockResolvedValue({ error: null });
    render(<ResendConfirmation email={EMAIL} />);

    await clickSend();

    const button = screen.getByRole('button', { name: /Send it again/ });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(`Send it again in ${RESEND_COOLDOWN_SECONDS}s`);

    act(() => { vi.advanceTimersByTime(1000); });
    expect(button).toHaveTextContent(`Send it again in ${RESEND_COOLDOWN_SECONDS - 1}s`);

    fireEvent.click(button);
    expect(mockResend).toHaveBeenCalledTimes(1);

    for (let i = 1; i < RESEND_COOLDOWN_SECONDS; i += 1) {
      act(() => { vi.advanceTimersByTime(1000); });
    }
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent(/^Send it again$/);
  });

  it('should show the friendly message when Supabase rate-limits the resend', async () => {
    mockResend.mockResolvedValue({
      error: authError({ message: 'For security purposes, you can only request this after 42 seconds.', status: 429, code: 'over_email_send_rate_limit' }),
    });
    render(<ResendConfirmation email={EMAIL} />);

    await clickSend();

    expect(screen.getByRole('status')).toHaveTextContent(RESEND_RATE_LIMITED_MESSAGE);
    expect(screen.getByRole('button', { name: /Send it again/ })).toBeDisabled();
  });

  it('should show the same success message when the address has no account', async () => {
    mockResend.mockResolvedValue({ error: authError({ message: 'User not found', status: 400 }) });
    render(<ResendConfirmation email={EMAIL} />);

    await clickSend();

    expect(screen.getByRole('status')).toHaveTextContent(RESEND_SENT_MESSAGE);
  });

  it('should say the connection failed when the request throws', async () => {
    mockResend.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<ResendConfirmation email={EMAIL} />);

    await clickSend();

    expect(screen.getByRole('status')).toHaveTextContent(RESEND_NETWORK_MESSAGE);
  });

  it('should keep the button disabled when there is no email', () => {
    render(<ResendConfirmation email="" />);

    expect(screen.getByRole('button', { name: /Send it again/ })).toBeDisabled();
  });
});

describe('classifyResendError', () => {
  it('should treat no error as sent', () => {
    expect(classifyResendError(null)).toBe('sent');
  });

  it('should detect a rate limit by status, code or message', () => {
    expect(classifyResendError(authError({ status: 429 }))).toBe('rate_limited');
    expect(classifyResendError(authError({ code: 'over_email_send_rate_limit' }))).toBe('rate_limited');
    expect(classifyResendError(authError({ message: 'Email rate limit exceeded' }))).toBe('rate_limited');
  });

  it('should detect a dropped connection', () => {
    expect(classifyResendError(authError({ name: 'AuthRetryableFetchError', status: 0 }))).toBe('network');
  });
});
