// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { getPostLoginRoute } from './postLoginRoute';
import { consumeOAuthSignUpIntent } from '../../utils/oauthSignUpIntent';
import { Loader2, CheckCircle, AlertCircle, UserCheck } from 'lucide-react';

/**
 * How recently a user record must have been created to count as brand new.
 *
 * The row is written by Supabase during the very callback we are handling, so
 * for a real first-time sign-up the gap is under a second. A minute absorbs
 * clock skew between the browser and Supabase without being loose enough to
 * call a returning user new.
 */
const NEW_ACCOUNT_WINDOW_MS = 60_000;

/**
 * Whether this session belongs to an account created just now.
 *
 * Unknown or unparseable timestamps answer "new", because the only thing this
 * gates is a notice: wrongly telling someone they already have an account is
 * alarming, while staying quiet is just the behaviour we had before.
 */
function isBrandNewAccount(createdAt: string | undefined): boolean {
  if (!createdAt) return true;
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) return true;
  return Date.now() - created < NEW_ACCOUNT_WINDOW_MS;
}

interface AuthParams {
  code: string | null;
  tokenHash: string | null;
  type: string | null;
}

/**
 * Extract Supabase auth params from the query string. Two shapes arrive here:
 *   1. PKCE (OAuth): ?code=ABC, exchangeable only by the browser that started it
 *   2. Auth email:   ?token_hash=XYZ&type=signup (auth-email-hook builds the link)
 *
 * A session is never taken from the URL fragment (#access_token=...): that was
 * the implicit flow, and accepting it let a crafted link sign a victim into an
 * attacker's account (security scan M6).
 */
function extractAuthParams(): AuthParams {
  const params = new URLSearchParams(window.location.search);
  return {
    code: params.get('code'),
    tokenHash: params.get('token_hash'),
    type: params.get('type'),
  };
}

/** The email_action_type values auth-email-hook sends, as verifyOtp takes them. */
const EMAIL_OTP_TYPES = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'] as const;
type EmailOtpType = (typeof EMAIL_OTP_TYPES)[number];
const isEmailOtpType = (t: string): t is EmailOtpType => (EMAIL_OTP_TYPES as readonly string[]).includes(t);

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'existing-account' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  // React.StrictMode double-invokes this effect in dev. Without this guard,
  // the second invocation re-runs exchangeCodeForSession/verifyOtp against an
  // already-consumed code/token_hash and can race the first call's identity
  // setup + navigate(). Mirrors the ref guard in LoginPage.
  const hasHandledRef = useRef(false);

  useEffect(() => {
    const handleCallback = async (): Promise<void> => {
      if (hasHandledRef.current) return;
      hasHandledRef.current = true;
      try {
        const search = new URLSearchParams(window.location.search);
        const oauthError = search.get('error_description') || search.get('error');
        if (oauthError) {
          setStatus('error');
          setErrorMessage(decodeURIComponent(oauthError));
          return;
        }

        const { code, tokenHash, type } = extractAuthParams();

        // Establish a session from whatever params are present. Supabase-js
        // (detectSessionInUrl: true) may have already exchanged an OAuth ?code=
        // and stripped it from the URL before this component mounted — so a
        // missing code or a failed re-exchange here is NOT fatal. We re-read
        // getSession() below and branch on the established session's provider,
        // not on whichever URL param happened to survive. This is the OAuth
        // fix: previously a pre-consumed code fell through to the fallback and
        // skipped completeOAuthLogin, so the ICP identity was never generated.
        if (code) {
          // Tolerate "code already consumed" — detectSessionInUrl may have won
          // the race. Awaiting ensures the session is settled before getSession.
          await supabase.auth.exchangeCodeForSession(code).catch(() => undefined);
        } else if (tokenHash && type && isEmailOtpType(type)) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type,
          });
          if (error) {
            setStatus('error');
            setErrorMessage(error.message);
            return;
          }
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) {
          setStatus('error');
          setErrorMessage(error.message);
          return;
        }
        if (!data.session) {
          setStatus('error');
          setErrorMessage('No verification code found. Please try clicking the link in your email again.');
          return;
        }

        // Any established session — OAuth (google/azure) or email/magic-link —
        // needs the same post-session ICP identity setup: generate a fresh key
        // for a brand-new user, or restore the existing one for a returning
        // user (retryKeyGeneration refuses to touch an existing key, so this
        // is safe to run unconditionally). completeOAuthLogin() is provider-
        // agnostic despite its name — it just reads the current session via
        // completeOAuthSession(), which shares _completePostAuthSetup with
        // password sign-in — so the same call covers every provider here.
        // Previously only google/azure ran this; a magic-link user landed
        // authenticated with principal: null and could never join a
        // transaction (TransactionInvite hard-requires principalId).
        const ok = await useAuthStore.getState().completeOAuthLogin();
        if (!ok) {
          setStatus('error');
          setErrorMessage(useAuthStore.getState().error || 'Sign-in failed. Please try again.');
          return;
        }
        // Someone who pressed "Continue with Google" on the register page and
        // already had an account gets signed in by Supabase with no hint that
        // no account was created. Say so rather than dropping them wherever
        // the existing account happens to belong. consumeOAuthSignUpIntent()
        // runs first either way, so the flag never survives into a later
        // sign-in in this tab.
        const startedAsSignUp = consumeOAuthSignUpIntent();
        if (startedAsSignUp && !isBrandNewAccount(data.session.user?.created_at)) {
          setStatus('existing-account');
          return;
        }

        setStatus('success');
        navigate(getPostLoginRoute(), { replace: true });
      } catch {
        setStatus('error');
        setErrorMessage('Failed to verify your email. Please try again.');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md mx-auto px-4 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Verifying your email...</h2>
            <p className="text-muted-foreground">Please wait while we confirm your account.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Email verified!</h2>
            <p className="text-muted-foreground">Redirecting you to sign in...</p>
          </>
        )}

        {status === 'existing-account' && (
          <>
            <UserCheck className="h-12 w-12 text-[#5F8A68] mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">You already have an account</h2>
            <p className="text-muted-foreground mb-4">
              That email is already registered with PropXchain, so we signed you
              in instead of creating a second account.
            </p>
            <button
              onClick={() => navigate(getPostLoginRoute(), { replace: true })}
              className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 underline"
            >
              Continue
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Verification failed</h2>
            <p className="text-muted-foreground mb-4">{errorMessage}</p>
            <button
              onClick={() => navigate('/login')}
              className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 underline"
            >
              Go to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
