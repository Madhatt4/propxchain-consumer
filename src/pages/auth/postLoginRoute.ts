// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { useAuthStore } from '../../stores/authStore';
import { isAdminPrincipal } from '../../constants/adminPrincipals';
import { consumePendingInviteUrl } from '../../utils/pendingInviteUrl';

/**
 * Shared post-login routing decision for the consumer app. Used by LoginPage
 * (email/II) and AuthCallback (OAuth) so social and password logins land in
 * the same places. It is also the seam that eventually fires for a magic-link
 * / email-verification login, since AuthCallback bounces those back to
 * `/login`, whose own "already authenticated" effect calls this function too
 * — so this single function is where every successful auth method lands,
 * without needing changes in `router/decideRoute.ts`.
 *
 * A pending invite URL (stored by JoinTransactionPage when it redirects a
 * logged-out visitor to `/login`) takes priority over everything else,
 * including `fromPath`: the invite link is the destination the user actually
 * clicked, and JoinTransactionPage never sets `location.state.from` itself,
 * so the two never legitimately compete.
 *
 * `fromPath` is the route the user was trying to reach before being bounced to
 * login (LoginPage reads it from `location.state.from`). When set, it wins.
 */
export function getPostLoginRoute(fromPath?: string): string {
  const pendingInviteUrl = consumePendingInviteUrl();
  if (pendingInviteUrl) return pendingInviteUrl;

  if (fromPath) return fromPath;

  const authState = useAuthStore.getState();
  if (authState.orgJustCreated) return '/post-login?fresh=1';
  if (isAdminPrincipal(authState.principalId)) return '/dashboard';
  if (authState.authMethod === 'ii') return '/dashboard';

  const role = authState.supabaseUser?.user_metadata?.role as string | undefined;

  // Role gate: a Supabase user with no role is a social sign-up (Google /
  // Microsoft give a name + email but no role). Send them to /profile-setup to
  // choose a role + mobile before any dashboard.
  if (authState.authMethod === 'supabase' && !role) return '/profile-setup';

  if (role === 'solicitor') return '/conveyancer';

  const onboarded = authState.supabaseUser?.user_metadata?.propxchain_onboarded === true
    || localStorage.getItem('onboardingComplete') === 'true';
  if (!onboarded) {
    if (role === 'seller') return '/start-transaction';
    if (role === 'buyer') return '/onboarding/join';
  }
  return '/post-login';
}
