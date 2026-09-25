// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * RedeemDeveloperInvitePage — Buyer invite token redemption (Task 1b.9).
 *
 * Route: /redeem/dev?token=ABC123...
 *
 * Flow:
 *   1. Extract token from URL query params
 *   2. Validate the token (loading -> error if invalid/expired/redeemed)
 *   3. If valid: show signup form (email + password)
 *   4. After signup: show "check your email" screen
 *   5. Store token in localStorage for redemption on first login
 *
 * DESIGN.md compliance: Fraunces headline, DM Sans body, teal primary,
 * clean minimal layout matching RegisterDeveloperPage.
 */

import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabaseAuthService } from '../../services/supabase.auth.service';
import {
  inviteService,
  PENDING_INVITE_TOKEN_KEY,
} from '../../services/invite.service';
import BlueprintBackground from '../../components/common/BlueprintBackground';

type PageState = 'loading' | 'error' | 'valid' | 'check-email';

interface TokenError {
  title: string;
  message: string;
}

const RedeemDeveloperInvitePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [pageState, setPageState] = useState<PageState>('loading');
  const [tokenError, setTokenError] = useState<TokenError | null>(null);

  // Account form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setTokenError({
        title: 'No invite token',
        message: 'This link is missing the invite token. Please use the link from your invitation email.',
      });
      setPageState('error');
      return;
    }

    let cancelled = false;

    const validate = async (): Promise<void> => {
      try {
        const result = await inviteService.validateToken(token);
        if (cancelled) return;

        if (result.redeemed) {
          setTokenError({
            title: 'Already redeemed',
            message: 'This invite has already been used. If you already have an account, please log in.',
          });
          setPageState('error');
        } else if (result.expired) {
          setTokenError({
            title: 'Invite expired',
            message: 'This invite has expired. Please ask the developer to send a new one.',
          });
          setPageState('error');
        } else if (!result.valid) {
          setTokenError({
            title: 'Invalid invite',
            message: 'We could not find this invite. Please check the link from your email.',
          });
          setPageState('error');
        } else {
          setPageState('valid');
        }
      } catch {
        if (cancelled) return;
        setTokenError({
          title: 'Something went wrong',
          message: 'We could not verify your invite. Please try again later.',
        });
        setPageState('error');
      }
    };

    validate();
    return () => { cancelled = true; };
  }, [token]);

  const handleSignupSubmit = async (
    e: React.FormEvent,
  ): Promise<void> => {
    e.preventDefault();
    setFormError(null);

    if (password.length < 8) {
      setFormError('Choose a longer password — at least 8 characters.');
      return;
    }
    if (password !== passwordConfirm) {
      setFormError('Passwords do not match.');
      return;
    }

    setSignupLoading(true);
    try {
      const result = await supabaseAuthService.signUp(email, password, {
        name: email,
        role: 'buyer',
      });

      if (result.error) {
        setFormError(
          result.error.message || 'Sign up failed. Please try again.',
        );
        setSignupLoading(false);
        return;
      }

      // Store token for redemption on first login
      localStorage.setItem(PENDING_INVITE_TOKEN_KEY, token);
      setPageState('check-email');
    } catch {
      setFormError('Sign up failed. Please try again.');
    } finally {
      setSignupLoading(false);
    }
  };

  // ── Render sections ─────────────────────────────────────────────────────

  const renderLoading = (): React.ReactElement => (
    <div className="flex flex-col items-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-[#0D9488]" />
      <p className="mt-4 font-[DM_Sans] text-base text-[#6B7280]">
        Verifying your invite...
      </p>
    </div>
  );

  const renderError = (): React.ReactElement => (
    <div className="text-center">
      <h1 className="font-[Fraunces] text-[2rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] dark:text-white sm:text-[2.5rem]">
        {tokenError?.title ?? 'Invalid invite'}
      </h1>
      <p className="mt-4 max-w-md mx-auto font-[DM_Sans] text-base text-[#6B7280] dark:text-gray-400">
        {tokenError?.message}
      </p>
      <div className="mt-8 flex flex-col items-center gap-3">
        <Link
          to="/login"
          className="font-[DM_Sans] text-sm font-medium text-[#0D9488] hover:underline"
        >
          Already have an account? Log in
        </Link>
        <Link
          to="/"
          className="font-[DM_Sans] text-sm text-[#6B7280] hover:text-[#1A1A1A] dark:hover:text-white"
        >
          Back to homepage
        </Link>
      </div>
    </div>
  );

  const renderSignupForm = (): React.ReactElement => (
    <>
      <h1 className="font-[Fraunces] text-[2rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] dark:text-white sm:text-[2.5rem]">
        Accept your invitation.
      </h1>
      <p className="mt-3 max-w-md font-[DM_Sans] text-base text-[#6B7280] dark:text-gray-400">
        Create an account to view your reserved plot and start the purchase
        process.
      </p>

      <form onSubmit={handleSignupSubmit} className="mt-10 space-y-6">
        <div>
          <label
            htmlFor="invite-signup-email"
            className="block font-[DM_Sans] text-sm font-medium text-[#1A1A1A] dark:text-gray-200"
          >
            Email address
          </label>
          <input
            id="invite-signup-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="mt-2 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-3 font-[DM_Sans] text-base text-[#1A1A1A] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488] dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div>
          <label
            htmlFor="invite-signup-password"
            className="block font-[DM_Sans] text-sm font-medium text-[#1A1A1A] dark:text-gray-200"
          >
            Password
          </label>
          <input
            id="invite-signup-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="mt-2 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-3 font-[DM_Sans] text-base text-[#1A1A1A] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488] dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
          <p className="mt-1 font-[DM_Sans] text-xs text-[#6B7280] dark:text-gray-400">
            At least 8 characters.
          </p>
        </div>
        <div>
          <label
            htmlFor="invite-signup-password-confirm"
            className="block font-[DM_Sans] text-sm font-medium text-[#1A1A1A] dark:text-gray-200"
          >
            Confirm password
          </label>
          <input
            id="invite-signup-password-confirm"
            type="password"
            required
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            autoComplete="new-password"
            className="mt-2 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-3 font-[DM_Sans] text-base text-[#1A1A1A] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488] dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>

        {formError && (
          <div className="rounded-md border border-[#DC2626]/30 bg-[#FEF2F2] p-3 font-[DM_Sans] text-sm text-[#DC2626] dark:bg-red-900/20 dark:border-red-800/40">
            {formError}
          </div>
        )}

        <button
          type="submit"
          disabled={signupLoading}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-[#0D9488] px-8 py-3 font-[DM_Sans] text-base font-medium text-white transition-colors hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:bg-[#9CA3AF]"
        >
          {signupLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            'Create account'
          )}
        </button>
      </form>

      <p className="mt-6 font-[DM_Sans] text-sm text-[#6B7280] dark:text-gray-400">
        Already have an account?{' '}
        <Link
          to="/login"
          className="text-[#0D9488] hover:underline"
        >
          Log in
        </Link>
      </p>
    </>
  );

  const renderCheckEmail = (): React.ReactElement => (
    <div className="text-center">
      <h1 className="font-[Fraunces] text-[2rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] dark:text-white sm:text-[2.5rem]">
        Check your email.
      </h1>
      <p className="mt-4 font-[DM_Sans] text-base text-[#6B7280] dark:text-gray-400">
        We sent a verification link to <strong className="text-[#1A1A1A] dark:text-white">{email}</strong>.
        Click it to activate your account, then sign in to access your
        reserved plot.
      </p>
      <div className="mt-8">
        <Link
          to="/login"
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-[#0D9488] px-8 py-3 font-[DM_Sans] text-base font-medium text-white transition-colors hover:bg-[#0F766E]"
        >
          Go to login
        </Link>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen bg-[#FAFAF8]/70 text-[#1A1A1A] dark:bg-gray-900/70 dark:text-white">
      <BlueprintBackground />
      <header className="relative z-10 border-b border-[#E5E7EB] bg-[#FAFAF8]/80 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/80">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-5">
          <Link
            to="/"
            className="font-[Fraunces] text-xl font-semibold tracking-tight text-[#1A1A1A] hover:text-[#0D9488] dark:text-white"
          >
            PropXchain
          </Link>
          <Link
            to="/login"
            className="font-[DM_Sans] text-sm text-[#1A1A1A] hover:text-[#0D9488] dark:text-gray-300"
          >
            Already have an account? Log in
          </Link>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-[640px] px-6 py-16">
        {pageState === 'loading' && renderLoading()}
        {pageState === 'error' && renderError()}
        {pageState === 'valid' && renderSignupForm()}
        {pageState === 'check-email' && renderCheckEmail()}
      </main>
    </div>
  );
};

export default RedeemDeveloperInvitePage;
