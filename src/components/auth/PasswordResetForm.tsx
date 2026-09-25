// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * PasswordResetForm — step 2 of the password reset chain.
 *
 *   /login  →  /forgot-password (here)  →  emailed link  →  /reset-password
 *
 * This was the only step in that chain still on the pre-design-system
 * scaffold: gray-800 buttons, system fonts, no AuthShell, no dark mode. Step 1
 * and step 3 both look like PropXchain, so a user following a reset link
 * dropped into what looked like a different product halfway through — on an
 * auth page, which is exactly where that costs you trust.
 *
 * Rebuilt on AuthShell to match ResetPasswordPage. The reset call itself is
 * unchanged; it always worked.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, MailCheck } from 'lucide-react';
import { supabaseAuthService } from '../../services/supabase.auth.service';
import AuthShell from './AuthShell';

const inputClasses =
  'mt-2 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-3 font-dm-sans text-base text-[#1A1A1A] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]';

const primaryButtonClasses =
  'inline-flex min-h-12 w-full items-center justify-center rounded-md bg-[#0D9488] px-6 py-3 font-dm-sans text-base font-medium text-white transition-colors hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:bg-[#9CA3AF]';

const linkClasses =
  'inline-flex min-h-11 items-center font-dm-sans text-sm font-medium text-[#0D9488] underline underline-offset-2 transition-colors hover:text-[#0F766E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488]';

const PasswordResetForm: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEmailSent, setIsEmailSent] = useState(false);
  const sentHeadingRef = useRef<HTMLHeadingElement>(null);

  // The whole pane swaps on success, which a screen reader has no reason to
  // announce. Move focus to the new heading so it is read out and keyboard
  // navigation continues from the right place.
  useEffect(() => {
    if (isEmailSent) sentHeadingRef.current?.focus();
  }, [isEmailSent]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { error: resetError } = await supabaseAuthService.resetPassword(email);
      if (resetError) {
        setError(resetError.message || 'Failed to send password reset email.');
        return;
      }
      setIsEmailSent(true);
    } catch {
      setError('Failed to send password reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isEmailSent) {
    return (
      <AuthShell topLink={{ label: 'Sign in', to: '/login' }}>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F0F5F0]">
          <MailCheck className="h-6 w-6 text-[#0D9488]" aria-hidden />
        </div>
        <h1
          ref={sentHeadingRef}
          tabIndex={-1}
          className="mt-6 font-fraunces text-[2rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] focus:outline-none"
        >
          Check your email.
        </h1>
        <p className="mt-3 font-dm-sans text-base text-[#6B7280]">
          We sent reset instructions to <strong className="text-[#1A1A1A]">{email}</strong>. The
          link is good for one use.
        </p>
        <p className="mt-4 font-dm-sans text-sm text-[#6B7280]">
          Nothing arrived? Check your spam folder, or send it again.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
          <button type="button" onClick={() => setIsEmailSent(false)} className={linkClasses}>
            Send it again
          </button>
          <Link to="/login" className={linkClasses}>
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell topLink={{ label: 'Sign in', to: '/login' }}>
      <h1 className="font-fraunces text-[2rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] sm:text-[2.5rem]">
        Reset your password.
      </h1>
      <p className="mt-3 font-dm-sans text-base text-[#6B7280]">
        Enter your email address and we&rsquo;ll send you a link to set a new one.
      </p>

      <form onSubmit={(e) => { void handleSubmit(e); }} className="mt-8 space-y-6">
        <div>
          <label
            htmlFor="reset-email"
            className="block font-dm-sans text-sm font-medium text-[#1A1A1A]"
          >
            Email address
          </label>
          <input
            id="reset-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClasses}
          />
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-[#DC2626]/30 bg-[#FEF2F2] p-3 font-dm-sans text-sm text-[#DC2626]"
          >
            {error}
          </div>
        )}

        <button type="submit" disabled={isLoading} className={primaryButtonClasses}>
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : 'Send reset link'}
        </button>
      </form>

      <div className="mt-6 border-t border-[#E5E7EB] pt-4">
        {/* Was window.location.href — a full document reload in a SPA. */}
        <button type="button" onClick={() => navigate('/login')} className={linkClasses}>
          Back to sign in
        </button>
      </div>
    </AuthShell>
  );
};

export default PasswordResetForm;
