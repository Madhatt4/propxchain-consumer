// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { decideRoute } from './decideRoute';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { isNativeApp } from '../lib/native';

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
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();

  // Routing waits for the canister's admin answer, so an admin is never sent
  // down the normal path first. Without a principal the admin query is
  // disabled and resolves immediately.
  const authReady = isInitialized && !isLoading && !isAdminLoading;

  // Admin escape hatch: platform admins always land on the dashboard,
  // whatever their email-verification state. Admin status comes from the
  // user_management canister, never from a list shipped in the bundle.
  useEffect(() => {
    if (navigatedRef.current) return;
    if (!authReady) return;
    if (!isAdmin) return;
    navigatedRef.current = true;
    navigate('/dashboard', { replace: true });
  }, [authReady, isAdmin, navigate]);

  // Internet Identity escape hatch: II users have no Supabase session, so
  // decideRoute() (which keys off `user`) would bounce them to /login. They
  // authenticate purely on the canister side — land them on the dashboard,
  // mirroring LoginPage.getPostLoginRoute's `authMethod === 'ii'` branch.
  // The email-verification gate does not apply to II.
  useEffect(() => {
    if (navigatedRef.current) return;
    if (!authReady) return;
    if (isAdmin) return; // admin handled above
    if (authMethod !== 'ii') return;
    navigatedRef.current = true;
    navigate('/dashboard', { replace: true });
  }, [authReady, authMethod, isAdmin, navigate]);

  useEffect(() => {
    if (navigatedRef.current) return;
    if (!authReady) return;
    if (isAdmin) return; // admin handled above
    if (authMethod === 'ii') return; // II handled above

    const decision = decideRoute({
      user: supabaseUser ? { id: supabaseUser.id } : null,
      emailVerified: supabaseUser?.email_confirmed_at != null,
      freshSignup: searchParams.get('fresh') === '1',
      native: isNativeApp(),
    });

    navigatedRef.current = true;
    navigate(decision.path, { replace: true });
  }, [authReady, authMethod, supabaseUser, searchParams, navigate, isAdmin]);

  return <FullPageSpinner />;
};

export default AuthGate;
