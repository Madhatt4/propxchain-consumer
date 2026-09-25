// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore, usePrincipalId } from '../stores/authStore';
import { decideRoute } from './decideRoute';
import { useMembershipsQuery } from './useMembershipsQuery';
import { readCookie, LAST_USED_ROLE_COOKIE } from './cookies';
import { isAdminPrincipal } from '../constants/adminPrincipals';
import {
  PENDING_ORG_KEY,
  PENDING_ESTATE_AGENT_ORG_KEY,
} from '../services/supabase.auth.service';

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

const ErrorFallback: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
    <p className="text-sm text-muted-foreground">
      Failed to load your accounts — please try again.
    </p>
    <button
      type="button"
      onClick={onRetry}
      className="min-h-11 min-w-[44px] px-4 py-2 text-sm font-medium rounded-md bg-gray-800 text-white hover:bg-gray-700"
    >
      Try again
    </button>
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

  const membershipsQuery = useMembershipsQuery(supabaseUser?.id);

  const authReady = isInitialized && !isLoading;
  const membershipsReady =
    !membershipsQuery.isLoading && !membershipsQuery.isFetching;

  // Admin escape hatch: platform admins always land on the consumer
  // dashboard regardless of memberships, pending dev orgs, or cookies.
  // Mirrors LoginPage.getPostLoginRoute and Dashboard_Premium's bypass —
  // without this, a stale pending_developer_org flag or a hung
  // memberships query traps an admin on /post-login.
  useEffect(() => {
    if (navigatedRef.current) return;
    if (!authReady) return;
    if (!isAdminPrincipal(principalId)) return;
    navigatedRef.current = true;
    navigate('/dashboard', { replace: true });
  }, [authReady, principalId, navigate]);

  // Internet Identity escape hatch: II users have no Supabase session, so
  // decideRoute() (which keys off `user`) would bounce them to /login. They
  // authenticate purely on the canister side — land them on the consumer
  // dashboard, mirroring LoginPage.getPostLoginRoute's `authMethod === 'ii'`
  // branch. Memberships/email-verification gates don't apply to II.
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
    if (membershipsQuery.isError) return;
    if (!membershipsReady) return;

    const decision = decideRoute({
      user: supabaseUser ? { id: supabaseUser.id } : null,
      memberships: membershipsQuery.data ?? [],
      cookie: { lastUsedRole: readCookie(LAST_USED_ROLE_COOKIE) },
      queryParams: { role: searchParams.get('role') ?? undefined },
      emailVerified: supabaseUser?.email_confirmed_at != null,
      freshSignup: searchParams.get('fresh') === '1',
      hasPendingDeveloperOrg: supabaseUser?.user_metadata?.[PENDING_ORG_KEY] != null,
      hasPendingEstateAgentOrg: supabaseUser?.user_metadata?.[PENDING_ESTATE_AGENT_ORG_KEY] != null,
    });

    navigatedRef.current = true;
    navigate(decision.path, { replace: true });
  }, [
    authReady,
    authMethod,
    membershipsReady,
    membershipsQuery.isError,
    membershipsQuery.data,
    supabaseUser,
    searchParams,
    navigate,
    principalId,
  ]);

  if (membershipsQuery.isError) {
    return <ErrorFallback onRetry={() => membershipsQuery.refetch()} />;
  }

  return <FullPageSpinner />;
};

export default AuthGate;
