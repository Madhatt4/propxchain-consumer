// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type {
  OrganisationMembership,
  OrganisationType,
} from './decideRoute';

/**
 * React Query hook for the current user's organisation memberships.
 *
 * Query is gated on a non-null userId — passing `undefined` disables
 * the query (React Query `enabled: false`). Under the hood the server
 * still applies RLS via migration 003, so the result is always just
 * the caller's memberships regardless of what we pass here.
 */

interface MembershipRow {
  organisation_id: string;
  role: string;
  organisations: { type: OrganisationType } | null;
}

const FIVE_MINUTES = 5 * 60 * 1000;
const THIRTY_MINUTES = 30 * 60 * 1000;

export function useMembershipsQuery(
  userId: string | undefined,
): UseQueryResult<OrganisationMembership[], Error> {
  return useQuery<OrganisationMembership[], Error>({
    queryKey: ['memberships', userId],
    enabled: userId != null,
    staleTime: FIVE_MINUTES,
    gcTime: THIRTY_MINUTES,
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('organisation_memberships')
        .select('organisation_id, role, organisations!inner(type)')
        .eq('user_id', userId);

      if (error) {
        throw new Error(`memberships query failed: ${error.message}`);
      }

      const rows = (data ?? []) as unknown as MembershipRow[];
      return rows
        .filter((r): r is MembershipRow & { organisations: { type: OrganisationType } } =>
          r.organisations != null,
        )
        .map((r) => ({
          organisationId: r.organisation_id,
          organisationType: r.organisations.type,
          role: r.role,
        }));
    },
  });
}
