// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { resend, signUp } = vi.hoisted(() => ({
  resend: vi.fn(),
  signUp: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { resend, signUp } },
}));
vi.mock('@/lib/analytics', () => ({ trackSignUp: vi.fn() }));

import { supabaseAuthService } from '../supabase.auth.service';

const EMAIL = 'new.user@example.com';
const REDIRECT = `${window.location.origin}/auth/callback`;

describe('supabaseAuthService.resendSignupConfirmation', () => {
  beforeEach(() => {
    resend.mockReset();
    signUp.mockReset();
  });

  it('should call auth.resend with type signup, the email and the signUp redirect', async () => {
    resend.mockResolvedValue({ data: {}, error: null });

    const result = await supabaseAuthService.resendSignupConfirmation(EMAIL);

    expect(resend).toHaveBeenCalledWith({
      type: 'signup',
      email: EMAIL,
      options: { emailRedirectTo: REDIRECT },
    });
    expect(result.error).toBeNull();
  });

  it('should use the same redirect as signUp', async () => {
    resend.mockResolvedValue({ data: {}, error: null });
    signUp.mockResolvedValue({ data: { user: null }, error: null });

    await supabaseAuthService.signUp(EMAIL, 'password-123', { name: 'Test', role: 'buyer' });
    await supabaseAuthService.resendSignupConfirmation(EMAIL);

    const signUpRedirect = signUp.mock.calls[0][0].options.emailRedirectTo;
    expect(resend.mock.calls[0][0].options.emailRedirectTo).toBe(signUpRedirect);
  });

  it('should pass a Supabase error back to the caller', async () => {
    const error = Object.assign(new Error('rate limited'), { status: 429 });
    resend.mockResolvedValue({ data: {}, error });

    const result = await supabaseAuthService.resendSignupConfirmation(EMAIL);

    expect(result.error).toBe(error);
  });
});
