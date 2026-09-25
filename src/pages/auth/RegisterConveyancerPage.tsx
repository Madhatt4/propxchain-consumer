// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabaseAuthService } from '../../services/supabase.auth.service';
import {
  lookupPracticeByClcId,
  normalizeClcId,
  type ClcPractice,
} from '../../services/clc.service';

/**
 * RegisterConveyancerPage — Solicitor/Conveyancer signup for the PropXchain
 * panel. Mirrors RegisterDeveloperPage: two visible steps, CLC lookup is
 * the magic moment.
 *
 * Step 1 — Firm details
 *   User enters CLC practice ID → live lookup against Supabase clc_practices
 *   table populates practice name + address. Non-active firms (revoked,
 *   intervened, no longer regulated) block submission.
 *
 * Step 2 — Account credentials
 *   Creates a Supabase user with role='solicitor' and firm details in
 *   user_metadata. The existing first-login onboarding hook materialises
 *   their workspace once they verify their email and sign in.
 */

type Step = 'firm' | 'account' | 'check-email';

interface FirmDetails {
  clcId: string;
  practiceName: string;
  clcData: ClcPractice | null;
  verified: boolean;
}

const PENDING_FIRM_KEY = 'propxchain_pending_conveyancer_firm';
const PENDING_FIRM_EXPIRES_KEY = 'propxchain_pending_conveyancer_firm_expires_at';

const RegisterConveyancerPage: React.FC = () => {
  const [step, setStep] = useState<Step>('firm');

  // Firm details state
  const [clcInput, setClcInput] = useState('');
  const [clcLookupLoading, setClcLookupLoading] = useState(false);
  const [clcData, setClcData] = useState<ClcPractice | null>(null);
  const [clcLookupRan, setClcLookupRan] = useState(false);

  // Account state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [fallbackPracticeName, setFallbackPracticeName] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced CLC lookup
  useEffect(() => {
    const normalised = normalizeClcId(clcInput);
    if (!normalised) {
      setClcData(null);
      setClcLookupRan(false);
      return;
    }
    let cancelled = false;
    setClcLookupLoading(true);
    const timer = setTimeout(async () => {
      const result = await lookupPracticeByClcId(normalised);
      if (cancelled) return;
      setClcData(result);
      setClcLookupRan(true);
      setClcLookupLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setClcLookupLoading(false);
    };
  }, [clcInput]);

  const normalisedClc = normalizeClcId(clcInput);
  const isInactive = clcData != null && !clcData.isActive;
  const canContinue = !!normalisedClc && !isInactive && !clcLookupLoading;

  const firmDetails: FirmDetails | null = canContinue && normalisedClc
    ? {
        clcId: normalisedClc,
        practiceName: clcData?.practiceName ?? fallbackPracticeName,
        clcData,
        verified: clcData != null && clcData.isActive,
      }
    : null;

  const handleFirmContinue = (): void => {
    if (!canContinue) return;
    setError(null);
    setStep('account');
  };

  const handleSignupSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    if (!firmDetails) {
      setError('Please complete the firm details first.');
      setStep('firm');
      return;
    }
    if (!firmDetails.verified && !fallbackPracticeName.trim()) {
      setError('We could not find that CLC ID in our snapshot of the register. Please enter your firm name to continue — we will verify manually.');
      return;
    }
    if (password.length < 8) {
      setError('Choose a longer password — at least 8 characters.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Passwords do not match.');
      return;
    }

    setSignupLoading(true);
    try {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const practiceName =
        firmDetails.clcData?.practiceName ?? fallbackPracticeName.trim();
      const pendingPayload = {
        name: practiceName,
        clc_id: firmDetails.clcId,
        clc_verified: firmDetails.verified,
        clc_data: firmDetails.clcData,
      };

      const result = await supabaseAuthService.signUp(email, password, {
        name: practiceName || email,
        role: 'solicitor',
        [PENDING_FIRM_KEY]: pendingPayload,
        [PENDING_FIRM_EXPIRES_KEY]: expiresAt,
      });

      if (result.error) {
        setError(result.error.message || 'Sign up failed. Please try again.');
        setSignupLoading(false);
        return;
      }
      setStep('check-email');
    } catch (err) {
      console.error('conveyancer signup failed:', err);
      setError('Sign up failed. Please try again.');
    } finally {
      setSignupLoading(false);
    }
  };

  const renderFirmStep = (): React.ReactElement => (
    <>
      <h1 className="font-[Fraunces] text-[2rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] sm:text-[2.5rem]">
        Tell us about your firm.
      </h1>
      <p className="mt-3 max-w-md font-[DM_Sans] text-base text-[#6B7280]">
        We&apos;ll pull your firm details from the Council for Licensed
        Conveyancers register so you don&apos;t have to retype them.
      </p>

      <div className="mt-10">
        <label className="block font-[DM_Sans] text-sm font-medium text-[#1A1A1A]">
          CLC practice ID
        </label>
        <div className="relative mt-2">
          <input
            type="text"
            value={clcInput}
            onChange={(e) => setClcInput(e.target.value)}
            placeholder="e.g. 11097"
            autoComplete="off"
            inputMode="numeric"
            className="w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-3 font-[DM_Sans] text-base text-[#1A1A1A] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
          />
          {clcLookupLoading && (
            <Loader2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-[#5F8A68]" />
          )}
        </div>
        <p className="mt-1 font-[DM_Sans] text-xs text-[#6B7280]">
          Find yours on the CLC register at{' '}
          <a href="https://www.clc-uk.org" target="_blank" rel="noopener noreferrer" className="text-[#0D9488] hover:underline">
            clc-uk.org
          </a>
          .
        </p>

        {clcData && (
          <div className="mt-4 rounded-md border border-[#0D9488]/30 bg-[#CCFBF1]/30 p-4">
            <p className="font-[Fraunces] text-lg font-semibold text-[#1A1A1A]">
              {clcData.practiceName}
            </p>
            {clcData.regulatedFrom && (
              <p className="mt-1 font-[DM_Sans] text-sm text-[#5F8A68]">
                {clcData.isActive ? 'Active' : clcData.status} since{' '}
                {clcData.regulatedFrom.slice(0, 4)}
              </p>
            )}
            {clcData.address && (
              <p className="mt-2 font-[DM_Sans] text-sm text-[#6B7280]">
                {clcData.address}
              </p>
            )}
          </div>
        )}

        {clcLookupRan && !clcData && normalisedClc && (
          <div className="mt-4 rounded-md border border-[#E5E7EB] bg-[#FAFAF8] p-4">
            <p className="font-[DM_Sans] text-sm text-[#6B7280]">
              We couldn&apos;t find that CLC ID in our snapshot of the register
              — the list is refreshed periodically so newly-licensed firms may
              not appear yet. You can continue — we&apos;ll mark your account
              as unverified and verify manually within 24 hours.
            </p>
          </div>
        )}

        {isInactive && (
          <div className="mt-4 rounded-md border border-[#DC2626]/30 bg-[#FEF2F2] p-4">
            <p className="font-[DM_Sans] text-sm text-[#DC2626]">
              This practice is marked as <strong>{clcData?.status}</strong> on
              the CLC register. Please contact support before continuing.
            </p>
            <a
              href="mailto:support@propxchain.com?subject=Conveyancer%20signup%20-%20inactive%20practice"
              className="mt-3 inline-block font-[DM_Sans] text-sm font-medium text-[#0D9488] hover:underline"
            >
              Contact support →
            </a>
          </div>
        )}
      </div>

      <div className="mt-10">
        <button
          type="button"
          onClick={handleFirmContinue}
          disabled={!canContinue}
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-[#0D9488] px-8 py-3 font-[DM_Sans] text-base font-medium text-white transition-colors hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:bg-[#9CA3AF]"
        >
          Continue
        </button>
      </div>
    </>
  );

  const renderAccountStep = (): React.ReactElement => (
    <>
      <h1 className="font-[Fraunces] text-[2rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] sm:text-[2.5rem]">
        Create your account.
      </h1>
      <p className="mt-3 max-w-md font-[DM_Sans] text-base text-[#6B7280]">
        We&apos;ll send you a verification email to confirm it&apos;s you.
      </p>
      {firmDetails?.clcData?.practiceName && (
        <p className="mt-4 font-[DM_Sans] text-sm text-[#5F8A68]">
          Applying as <strong>{firmDetails.clcData.practiceName}</strong>
        </p>
      )}

      <form onSubmit={handleSignupSubmit} className="mt-10 space-y-6">
        {!firmDetails?.verified && (
          <div>
            <label htmlFor="sol-signup-firm" className="block font-[DM_Sans] text-sm font-medium text-[#1A1A1A]">
              Firm name
            </label>
            <input
              id="sol-signup-firm"
              type="text"
              required
              value={fallbackPracticeName}
              onChange={(e) => setFallbackPracticeName(e.target.value)}
              autoComplete="organization"
              placeholder="Your registered practice name"
              className="mt-2 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-3 font-[DM_Sans] text-base text-[#1A1A1A] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
            />
            <p className="mt-1 font-[DM_Sans] text-xs text-[#6B7280]">
              Your application will be verified manually against the CLC register before you receive referrals.
            </p>
          </div>
        )}
        <div>
          <label htmlFor="sol-signup-email" className="block font-[DM_Sans] text-sm font-medium text-[#1A1A1A]">
            Email address
          </label>
          <input
            id="sol-signup-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="mt-2 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-3 font-[DM_Sans] text-base text-[#1A1A1A] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
          />
        </div>
        <div>
          <label htmlFor="sol-signup-password" className="block font-[DM_Sans] text-sm font-medium text-[#1A1A1A]">
            Password
          </label>
          <input
            id="sol-signup-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="mt-2 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-3 font-[DM_Sans] text-base text-[#1A1A1A] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
          />
          <p className="mt-1 font-[DM_Sans] text-xs text-[#6B7280]">
            At least 8 characters.
          </p>
        </div>
        <div>
          <label htmlFor="sol-signup-password-confirm" className="block font-[DM_Sans] text-sm font-medium text-[#1A1A1A]">
            Confirm password
          </label>
          <input
            id="sol-signup-password-confirm"
            type="password"
            required
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            autoComplete="new-password"
            className="mt-2 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-3 font-[DM_Sans] text-base text-[#1A1A1A] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
          />
        </div>

        {error && (
          <div className="rounded-md border border-[#DC2626]/30 bg-[#FEF2F2] p-3 font-[DM_Sans] text-sm text-[#DC2626]">
            {error}
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setStep('firm')}
            disabled={signupLoading}
            className="font-[DM_Sans] text-sm text-[#6B7280] hover:text-[#1A1A1A]"
          >
            ← Back
          </button>
          <button
            type="submit"
            disabled={signupLoading}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-md bg-[#0D9488] px-8 py-3 font-[DM_Sans] text-base font-medium text-white transition-colors hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:bg-[#9CA3AF]"
          >
            {signupLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              'Apply to the panel'
            )}
          </button>
        </div>
      </form>
    </>
  );

  const renderCheckEmailStep = (): React.ReactElement => (
    <div className="text-center">
      <h1 className="font-[Fraunces] text-[2rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] sm:text-[2.5rem]">
        Check your email.
      </h1>
      <p className="mt-4 font-[DM_Sans] text-base text-[#6B7280]">
        We sent a verification link to <strong>{email}</strong>. Click it to
        activate your account, then sign in to finish your panel application.
      </p>
      <p className="mt-8 font-[DM_Sans] text-sm text-[#6B7280]">
        Wrong email?{' '}
        <button
          type="button"
          onClick={() => setStep('account')}
          className="text-[#0D9488] hover:underline"
        >
          Go back
        </button>
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1A1A1A]">
      <header className="border-b border-[#E5E7EB] bg-[#FAFAF8]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-5">
          <Link
            to="/"
            className="font-[Fraunces] text-xl font-bold tracking-tight text-[#1A1A1A] transition-colors hover:text-[#0D9488]"
          >
            PropX<span className="text-[#0D9488]">chain</span>
          </Link>
          <Link
            to="/login"
            className="font-[DM_Sans] text-sm text-[#1A1A1A] transition-colors hover:text-[#0D9488]"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[640px] px-6 py-16">
        {step === 'firm' && renderFirmStep()}
        {step === 'account' && renderAccountStep()}
        {step === 'check-email' && renderCheckEmailStep()}
      </main>
    </div>
  );
};

export default RegisterConveyancerPage;
