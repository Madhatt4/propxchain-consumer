// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { IS_REGISTRATION_OPEN } from '../../config/registration';
import { useAuthStore } from '../../stores/authStore';
import AuthShell from '../../components/auth/AuthShell';
import LoginForm from '../../components/auth/LoginForm';
import { getPostLoginRoute as resolvePostLoginRoute } from './postLoginRoute';

/**
 * The standalone sign-in route.
 *
 * Everything about the form itself lives in <LoginForm>, which the landing
 * page's sign-in dialog renders too. What stays here is what only a real route
 * can do: honour `location.state.from` set by ProtectedRoute, show the
 * session-expiry notice, and bounce an already-authenticated visitor onward.
 */
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);

  const { isAuthenticated, isInitialized } = useAuthStore();

  const getPostLoginRoute = useCallback((): string => {
    const fromState = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    return resolvePostLoginRoute(fromState);
  }, [location.state]);

  // getPostLoginRoute() consumes the pending-invite localStorage entry as a
  // side effect (see pendingInviteUrl.ts) — it can only safely run once per
  // login. React.StrictMode double-invokes this effect in dev, and without
  // this guard the second invocation reads an already-cleared pending URL,
  // falls back to the ordinary role-based route, and its navigate() call
  // (running after the first) wins — silently dropping the invite
  // destination. The ref makes the effect fire at most once regardless of
  // how many times React re-runs it.
  const hasNavigatedRef = useRef(false);
  useEffect(() => {
    if (hasNavigatedRef.current) return;
    if (isInitialized && isAuthenticated) {
      hasNavigatedRef.current = true;
      navigate(getPostLoginRoute(), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, isAuthenticated, navigate]);

  useEffect(() => {
    if (searchParams.get('expired') === 'true') {
      setSessionExpiredMessage('Your session has expired. Please log in again.');
    }
  }, [searchParams]);

  return (
    <AuthShell
      topLink={
        IS_REGISTRATION_OPEN ? { label: 'Get started', to: '/register' } : undefined
      }
    >
      <h1 className="font-fraunces text-[2rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] sm:text-[2.5rem]">
        Sign in.
      </h1>

      <LoginForm
        warning={sessionExpiredMessage}
        onSuccess={() => navigate(getPostLoginRoute())}
      />
    </AuthShell>
  );
};

export default LoginPage;
