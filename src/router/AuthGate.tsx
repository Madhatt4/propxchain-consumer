// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore, usePrincipalId } from '../stores/authStore';
import { decideRoute } from './decideRoute';
import { isAdminPrincipal } from '../constants/adminPrincipals';

/**
 * Post-login landing gate.
 *
 * Scope: this component is ONLY mounted at `/post-login` and at `/`
 * (when the user is authenticated). It is NOT a per-route guard —
 * `<ProtectedRoute>` remains the auth+tier check on every protected
 * page. AuthGate's single job is "given everything I know about this
 * user, where should they land right now?"
 *
 * Deep links bounce through `<ProtectedRoute>` with `location.state.from`
 * — LoginPage honours that before falling back to `/post-login`, so
 * AuthGate never runs on direct-deep-link flows.
 */

const FullPageSpinner: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

const AuthGate: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const navigatedRef = useRef(false);

  const supabaseUser = useAuthStore((s) => s.supabaseUser);
  const authMethod = useAuthStore((s) => s.authMethod);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const isLoading = useAuthStore((s) => s.isLoading);
  const principalId = usePrincipalId();

  const authReady = isInitialized && !isLoading;

  // Admin escape hatch: platform admins always land on the dashboard,
  // whatever their email-verification state. Mirrors LoginPage.getPostLoginRoute.
  useEffect(() => {
    if (navigatedRef.current) return;
    if (!authReady) return;
    if (!isAdminPrincipal(principalId)) return;
    navigatedRef.current = true;
    navigate('/dashboard', { replace: true });
  }, [authReady, principalId, navigate]);

  // Internet Identity escape hatch: II users have no Supabase session, so
  // decideRoute() (which keys off `user`) would bounce them to /login. They
  // authenticate purely on the canister side — land them on the dashboard,
  // mirroring LoginPage.getPostLoginRoute's `authMethod === 'ii'` branch.
  // The email-verification gate does not apply to II.
  useEffect(() => {
    if (navigatedRef.current) return;
    if (!authReady) return;
    if (isAdminPrincipal(principalId)) return; // admin handled above
    if (authMethod !== 'ii') return;
    navigatedRef.current = true;
    navigate('/dashboard', { replace: true });
  }, [authReady, authMethod, principalId, navigate]);

  useEffect(() => {
    if (navigatedRef.current) return;
    if (!authReady) return;
    if (isAdminPrincipal(principalId)) return; // admin handled above
    if (authMethod === 'ii') return; // II handled above

    const decision = decideRoute({
      user: supabaseUser ? { id: supabaseUser.id } : null,
      emailVerified: supabaseUser?.email_confirmed_at != null,
      freshSignup: searchParams.get('fresh') === '1',
    });

    navigatedRef.current = true;
    navigate(decision.path, { replace: true });
  }, [authReady, authMethod, supabaseUser, searchParams, navigate, principalId]);

  return <FullPageSpinner />;
};

export default AuthGate;
