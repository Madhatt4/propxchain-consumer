// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useMembershipsQuery } from '@/router/useMembershipsQuery';
import type { SectionTab } from './SectionTabs';
import { portalKindsFor, sectionsFor, type PortalKind } from './portalSections';

/**
 * The side-menu sections for the signed-in user. `alwaysShow` keeps a portal's
 * own extras in its menu even when the user has no matching organisation, so
 * a platform admin looking at the agent portal can still move around it.
 */
export function usePortalSections(alwaysShow?: PortalKind): SectionTab[] {
  const supabaseUser = useAuthStore((s) => s.supabaseUser);
  const { data: memberships } = useMembershipsQuery(supabaseUser?.id);
  const signupRole = supabaseUser?.user_metadata?.role as string | undefined;

  return useMemo(() => {
    const kinds = portalKindsFor((memberships ?? []).map((m) => m.organisationType), signupRole);
    return sectionsFor(alwaysShow && !kinds.includes(alwaysShow) ? [...kinds, alwaysShow] : kinds);
  }, [memberships, signupRole, alwaysShow]);
}
