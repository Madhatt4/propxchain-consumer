// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useMembershipsQuery } from '@/router/useMembershipsQuery';
import type { SectionTab } from './SectionTabs';
import { portalKindsFor, sectionsFor, type PortalKind } from './portalSections';

/**
 * Which professional portals (agent, developer, conveyancer) this user has,
 * plus whether the organisation memberships behind the answer are still
 * loading. The sign-up role is known at once; memberships arrive from
 * Supabase, so a caller deciding where to send the user waits for `isLoading`.
 */
export function usePortalKindsQuery(): { kinds: PortalKind[]; isLoading: boolean } {
  const supabaseUser = useAuthStore((s) => s.supabaseUser);
  const { data: memberships, isLoading } = useMembershipsQuery(supabaseUser?.id);
  const signupRole = supabaseUser?.user_metadata?.role as string | undefined;

  const kinds = useMemo(
    () => portalKindsFor((memberships ?? []).map((m) => m.organisationType), signupRole),
    [memberships, signupRole],
  );
  return { kinds, isLoading: Boolean(supabaseUser?.id) && isLoading };
}

/** Which professional portals (agent, developer, conveyancer) this user has. */
export function usePortalKinds(): PortalKind[] {
  return usePortalKindsQuery().kinds;
}

/**
 * The side-menu sections for the signed-in user. `alwaysShow` keeps a portal's
 * own extras in its menu even when the user has no matching organisation, so
 * a platform admin looking at the agent portal can still move around it.
 */
export function usePortalSections(alwaysShow?: PortalKind): SectionTab[] {
  const kinds = usePortalKinds();

  return useMemo(
    () => sectionsFor(alwaysShow && !kinds.includes(alwaysShow) ? [...kinds, alwaysShow] : kinds),
    [kinds, alwaysShow],
  );
}
