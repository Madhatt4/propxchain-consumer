// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabaseAuthService } from '../../services/supabase.auth.service';
import {
  lookupCompany,
  normalizeCompanyNumber,
  type CompaniesHouseCompany,
} from '../../services/companies-house.service';
import BlueprintBackground from '../../components/common/BlueprintBackground';

/**
 * RegisterDeveloperPage — Door 2 signup for property developers (Task 1a.9).
 *
 * Two visible steps in a single page:
 *
 *   STEP 1 — Business details (CH autofill is the magic moment)
 *     User types Companies House number → live lookup populates the
 *     company name + address inline. Dissolved companies block submit.
 *     Network failures fall through unverified per E5.
 *
 *   STEP 2 — Account credentials (email + password)
 *     On submit, the FULL bundle (creds + business details snapshot)
 *     is packaged into supabase user_metadata via supabaseAuthService.signUp.
 *     The first-login hook in supabaseAuthService.signIn() materialises
 *     the org atomically after the user verifies their email and signs in.
 *
 * Business details first per design call: leading with the autofill is
 * the wow moment that makes the user feel "this thing knows who I am."
 *
 * DESIGN.md compliance: Fraunces headline, DM Sans body, teal #0D9488
 * primary CTA, sage accents, no blue, mobile-first.
 */

type Step = 'business' | 'account' | 'check-email';

interface BusinessDetails {
  companyNumber: string; // normalised
  companyName: string;
  chData: CompaniesHouseCompany | null;
  verified: boolean; // true iff CH lookup returned an active company
}

const PENDING_ORG_KEY = 'propxchain_pending_developer_org';
const PENDING_ORG_EXPIRES_KEY = 'propxchain_pending_developer_org_expires_at';

const RegisterDeveloperPage: React.FC = () => {
  const [step, setStep] = useState<Step>('business');

  // Business details state
  const [chInput, setChInput] = useState('');
  const [chLookupLoading, setChLookupLoading] = useState(false);
  const [chData, setChData] = useState<CompaniesHouseCompany | null>(null);
  const [chLookupRan, setChLookupRan] = useState(false);

  // Account state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── CH autofill: debounce on input change ─────────────────────────────────
  useEffect(() => {
    const normalised = normalizeCompanyNumber(chInput);
    if (!normalised) {
      setChData(null);
      setChLookupRan(false);
      return;
    }
    let cancelled = false;
    setChLookupLoading(true);
    const timer = setTimeout(async () => {
      const result = await lookupCompany(normalised);
      if (cancelled) return;
      setChData(result);
      setChLookupRan(true);
      setChLookupLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setChLookupLoading(false);
    };
  }, [chInput]);

  const normalisedNumber = normalizeCompanyNumber(chInput);
  const isDissolved = chData != null && !chData.isActive;
  const canContinueBusiness = !!normalisedNumber && !isDissolved && !chLookupLoading;

  const businessDetails: BusinessDetails | null = canContinueBusiness && normalisedNumber
    ? {
        companyNumber: normalisedNumber,
        companyName: chData?.name ?? '',
        chData,
        verified: chData != null && chData.isActive,
      }
    : null;

  const handleBusinessContinue = (): void => {
    if (!canContinueBusiness) return;
    setError(null);
    setStep('account');
  };

  const handleSignupSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    if (!businessDetails) {
      setError('Please complete the business details first.');
      setStep('business');
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
      const pendingPayload = {
        name: businessDetails.companyName || 'New developer organisation',
        companies_house_number: businessDetails.companyNumber,
        companies_house_verified: businessDetails.verified,
        companies_house_data: businessDetails.chData,
      };

      const result = await supabaseAuthService.signUp(email, password, {
        name: businessDetails.companyName || email,
        role: 'developer',
        [PENDING_ORG_KEY]: pendingPayload,
        [PENDING_ORG_EXPIRES_KEY]: expiresAt,
      });

      if (result.error) {
        setError(result.error.message || 'Sign up failed. Please try again.');
        setSignupLoading(false);
        return;
      }
      setStep('check-email');
    } catch (err) {
      console.error('developer signup failed:', err);
      setError('Sign up failed. Please try again.');
    } finally {
      setSignupLoading(false);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderBusinessStep = (): React.ReactElement => (
    <>
      <h1 className="font-[Fraunces] text-[2rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] sm:text-[2.5rem]">
        Tell us about your business.
      </h1>
      <p className="mt-3 max-w-md font-[DM_Sans] text-base text-[#6B7280]">
        We'll pull your company details from Companies House so you don't
        have to retype them.
      </p>

      <div className="mt-10">
        <label className="block font-[DM_Sans] text-sm font-medium text-[#1A1A1A]">
          Companies House number
        </label>
        <div className="relative mt-2">
          <input
            type="text"
            value={chInput}
            onChange={(e) => setChInput(e.target.value)}
            placeholder="e.g. 12345678 or SC123456"
            autoComplete="off"
            className="w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-3 font-[DM_Sans] text-base text-[#1A1A1A] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
          />
          {chLookupLoading && (
            <Loader2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-[#5F8A68]" />
          )}
        </div>

        {/* Inline autofill display */}
        {chData && (
          <div className="mt-4 rounded-md border border-[#0D9488]/30 bg-[#CCFBF1]/30 p-4">
            <p className="font-[Fraunces] text-lg font-semibold text-[#1A1A1A]">
              {chData.name}
            </p>
            {chData.incorporatedOn && (
              <p className="mt-1 font-[DM_Sans] text-sm text-[#5F8A68]">
                {chData.isActive ? 'Active' : chData.status} since{' '}
                {chData.incorporatedOn.slice(0, 4)}
              </p>
            )}
            {chData.address?.line1 && (
              <p className="mt-2 font-[DM_Sans] text-sm text-[#6B7280]">
                {[chData.address.line1, chData.address.locality, chData.address.postalCode]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}
          </div>
        )}

        {chLookupRan && !chData && normalisedNumber && (
          <div className="mt-4 rounded-md border border-[#E5E7EB] bg-[#FAFAF8] p-4">
            <p className="font-[DM_Sans] text-sm text-[#6B7280]">
              We couldn't find this company on Companies House. You can still
              continue — we'll mark your account as unverified and you can
              verify later.
            </p>
          </div>
        )}

        {isDissolved && (
          <div className="mt-4 rounded-md border border-[#DC2626]/30 bg-[#FEF2F2] p-4">
            <p className="font-[DM_Sans] text-sm text-[#DC2626]">
              This company is marked as <strong>{chData?.status}</strong> on
              Companies House. Please contact support to verify before
              continuing.
            </p>
            <a
              href="mailto:support@propxchain.com?subject=Dissolved%20company%20signup"
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
          onClick={handleBusinessContinue}
          disabled={!canContinueBusiness}
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
        We'll send you a verification email to confirm it's you.
      </p>
      {businessDetails?.companyName && (
        <p className="mt-4 font-[DM_Sans] text-sm text-[#5F8A68]">
          Signing up as <strong>{businessDetails.companyName}</strong>
        </p>
      )}

      <form onSubmit={handleSignupSubmit} className="mt-10 space-y-6">
        <div>
          <label htmlFor="dev-signup-email" className="block font-[DM_Sans] text-sm font-medium text-[#1A1A1A]">
            Email address
          </label>
          <input
            id="dev-signup-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="mt-2 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-3 font-[DM_Sans] text-base text-[#1A1A1A] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
          />
        </div>
        <div>
          <label htmlFor="dev-signup-password" className="block font-[DM_Sans] text-sm font-medium text-[#1A1A1A]">
            Password
          </label>
          <input
            id="dev-signup-password"
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
          <label htmlFor="dev-signup-password-confirm" className="block font-[DM_Sans] text-sm font-medium text-[#1A1A1A]">
            Confirm password
          </label>
          <input
            id="dev-signup-password-confirm"
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
            onClick={() => setStep('business')}
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
              'Create your developer account'
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
        activate your account, then sign in to finish setting up your
        developer organisation.
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
    <div className="relative min-h-screen bg-[#FAFAF8]/70 text-[#1A1A1A]">
      <BlueprintBackground />
      <header className="relative z-10 border-b border-[#E5E7EB] bg-[#FAFAF8]/80 backdrop-blur-sm">
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
      <main className="relative z-10 mx-auto max-w-[640px] px-6 py-16">
        {step === 'business' && renderBusinessStep()}
        {step === 'account' && renderAccountStep()}
        {step === 'check-email' && renderCheckEmailStep()}
      </main>
    </div>
  );
};

export default RegisterDeveloperPage;
