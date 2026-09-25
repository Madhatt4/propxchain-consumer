// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Mail, Fingerprint } from 'lucide-react';

import { IS_REGISTRATION_OPEN, PRELAUNCH_CAPTURE_PATH } from '../../config/registration';
import { useAuthStore, useIdentityError } from '../../stores/authStore';
import OAuthButtons from './OAuthButtons';
import LoginEmailForm from './LoginEmailForm';

/** Id of the step description, so a dialog frame can point aria-describedby at it. */
export const LOGIN_FORM_LEDE_ID = 'login-form-lede';

type AuthMethod = 'select' | 'email';

interface LoginFormProps {
  /** Fired once the user is authenticated. The frame decides where they go —
   *  /login honours `location.state.from`, the landing dialog has no such
   *  origin and simply resolves the role-based route. */
  onSuccess: () => void;
  /** A message the frame wants shown above the auth errors — /login uses it
   *  for the `?expired=true` session-expiry notice. */
  warning?: string | null;
}

/**
 * The sign-in surface itself: method choice, then whichever method was picked.
 *
 * Deliberately frameless. It is rendered inside AuthShell on /login and inside
 * a dialog on the landing page, and knowing nothing about either is what stops
 * the two drifting apart. The heading belongs to the frame (an <h1> on the
 * page, a DialogTitle in the card); everything from the lede down is here.
 */
const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, warning }) => {
  const [authMethod, setAuthMethod] = useState<AuthMethod>('select');
  const [iiLoading, setIiLoading] = useState(false);

  const { loginWithEmail, loginWithII, isLoading, error, clearError } = useAuthStore();
  const identityError = useIdentityError();

  const onEmailSubmit = async (email: string, password: string): Promise<void> => {
    clearError();
    const success = await loginWithEmail(email, password);
    if (success) onSuccess();
  };

  const handleIILogin = async (): Promise<void> => {
    clearError();
    setIiLoading(true);
    try {
      const success = await loginWithII();
      if (success) onSuccess();
    } finally {
      setIiLoading(false);
    }
  };

  const handleBackToMethods = (): void => {
    clearError();
    setAuthMethod('select');
  };

  return (
    <>
      <p id={LOGIN_FORM_LEDE_ID} className="mt-3 max-w-md font-dm-sans text-base text-[#6B7280]">
        {authMethod === 'select'
          ? 'Choose how you want to sign in.'
          : 'Enter your email and password.'}
      </p>

      <div className="mt-10">
        {warning && <Notice tone="warning">{warning}</Notice>}
        {identityError && <Notice tone="error">{identityError}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}

        {authMethod === 'select' && (
          <MethodSelection
            onSelectEmail={() => setAuthMethod('email')}
            onSelectII={handleIILogin}
            isLoading={isLoading}
            iiLoading={iiLoading}
          />
        )}

        {authMethod === 'email' && (
          <LoginEmailForm
            onSubmit={onEmailSubmit}
            isSubmitting={isLoading && !iiLoading}
            disabled={isLoading}
            onBack={handleBackToMethods}
          />
        )}
      </div>

      {/* Both branches are 44px (WCAG 2.5.5) — these were 18px, small grey
          text that read as a caption rather than a link. */}
      {IS_REGISTRATION_OPEN ? (
        <p className="mt-10 font-dm-sans text-sm text-[#6B7280]">
          New to PropXchain?{' '}
          <Link
            to="/register"
            className="inline-flex min-h-11 items-center font-medium text-[#0D9488] underline underline-offset-2 hover:text-[#0F766E]"
          >
            Create an account
          </Link>
        </p>
      ) : (
        <p className="mt-10 font-dm-sans text-sm text-[#6B7280]">
          Sign-ups open at launch.{' '}
          <Link
            to={PRELAUNCH_CAPTURE_PATH}
            className="inline-flex min-h-11 items-center font-medium text-[#0D9488] underline underline-offset-2 hover:text-[#0F766E]"
          >
            Get the free Home Mover Report
          </Link>{' '}
          meanwhile.
        </p>
      )}
    </>
  );
};

/* ------------------------------------------------------------------ */
/*  Notice — flat-bordered tinted strip (replaces nested Card alerts)  */
/* ------------------------------------------------------------------ */

interface NoticeProps {
  tone: 'error' | 'warning';
  children: React.ReactNode;
}

const Notice: React.FC<NoticeProps> = ({ tone, children }) => {
  const styles =
    tone === 'error'
      ? 'border-[#DC2626]/30 bg-[#FEF2F2] text-[#DC2626]'
      : 'border-[#D97706]/30 bg-[#FFF7ED] text-[#9A3412]';
  return (
    <div className={`mb-6 rounded-md border p-4 font-dm-sans text-sm ${styles}`}>
      {children}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Method Selection                                                   */
/* ------------------------------------------------------------------ */

interface MethodSelectionProps {
  onSelectEmail: () => void;
  onSelectII: () => void;
  isLoading: boolean;
  iiLoading: boolean;
}

const MethodSelection: React.FC<MethodSelectionProps> = ({
  onSelectEmail,
  onSelectII,
  isLoading,
  iiLoading,
}) => (
  <div className="space-y-3">
    <OAuthButtons disabled={isLoading || iiLoading} />

    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-[#E5E7EB]" />
      <span className="font-dm-sans text-xs uppercase tracking-wide text-[#9CA3AF]">or</span>
      <span className="h-px flex-1 bg-[#E5E7EB]" />
    </div>

    <MethodCard
      icon={<Mail className="h-5 w-5 text-[#5F8A68]" />}
      title="Continue with email"
      subtitle="Sign in with your email and password."
      onClick={onSelectEmail}
      disabled={isLoading || iiLoading}
    />
    {/*
      Internet Identity sign-in, alongside email. II users authenticate on
      the canister side but have no Supabase session, so Supabase-backed
      features (HMLR proxy, Stripe) 401 for them by design — that's an
      accepted limitation, not a bug (see project_quote_request_email_auth_only).
      Registration via II stays gated separately on the RegisterPage.
    */}
    <MethodCard
      icon={
        iiLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-[#5F8A68]" />
        ) : (
          <Fingerprint className="h-5 w-5 text-[#5F8A68]" />
        )
      }
      title={iiLoading ? 'Connecting…' : 'Continue with Internet Identity'}
      subtitle="Passkey-based decentralised sign-in."
      onClick={onSelectII}
      disabled={isLoading || iiLoading}
    />
  </div>
);

interface MethodCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  disabled?: boolean;
}

const MethodCard: React.FC<MethodCardProps> = ({ icon, title, subtitle, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="group flex w-full items-start gap-4 rounded-md border border-[#E5E7EB] bg-white px-4 py-4 text-left transition-colors hover:border-[#84A98C] hover:bg-[#F0F5F0] disabled:cursor-not-allowed disabled:opacity-60"
  >
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#DAE5DC]/60 group-hover:bg-[#DAE5DC]">
      {icon}
    </span>
    <span>
      <span className="block font-dm-sans text-sm font-semibold text-[#1A1A1A]">{title}</span>
      <span className="mt-0.5 block font-dm-sans text-sm text-[#6B7280]">{subtitle}</span>
    </span>
  </button>
);

export default LoginForm;
