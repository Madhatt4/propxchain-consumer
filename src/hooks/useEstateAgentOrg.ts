// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/authStore';
import { useMembershipsQuery } from '@/router/useMembershipsQuery';
import { supabase } from '@/lib/supabase';

export interface EstateAgentOrgState {
  organisationId: string | null;
  organisationName: string | null;
  isLoading: boolean;
  isError: boolean;
}

/** Fetches `organisations.name` for the resolved organisation id, if any. */
function useOrganisationName(organisationId: string | null): string | null {
  const { data } = useQuery({
    queryKey: ['organisation-name', organisationId],
    enabled: !!organisationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organisations')
        .select('name')
        .eq('id', organisationId!)
        .single();
      if (error) throw new Error(`Failed to fetch organisation name: ${error.message}`);
      return data as { name: string };
    },
  });
  return data?.name ?? null;
}

/** The signed-in user's estate agent organisation (first `agent` membership),
 *  plus its display name for use in slugs and copy. */
export function useEstateAgentOrg(): EstateAgentOrgState {
  const supabaseUser = useAuthStore((s) => s.supabaseUser);
  const { data, isLoading, isError } = useMembershipsQuery(supabaseUser?.id);
  const match = data?.find((m) => m.organisationType === 'agent') ?? null;
  const organisationId = match?.organisationId ?? null;
  const organisationName = useOrganisationName(organisationId);
  return { organisationId, organisationName, isLoading, isError };
}
