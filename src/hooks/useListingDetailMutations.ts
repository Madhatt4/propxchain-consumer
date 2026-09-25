// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The three mutations a listing's detail page can fire — update, status
 * change, publish — sharing one cache-invalidation callback.
 */

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { estateAgentListingsService } from '@/services/estateAgentListings.service';
import type { AgentListingStatus } from '@/types/estateAgentListing.types';
import type { MaterialInfo } from '@/types/materialInfo.types';

type UpdatePatch = Parameters<typeof estateAgentListingsService.update>[1];

export interface UseListingDetailMutationsResult {
  updateMutation: UseMutationResult<unknown, Error, UpdatePatch>;
  statusMutation: UseMutationResult<void, Error, AgentListingStatus>;
  publishMutation: UseMutationResult<string, Error, MaterialInfo>;
}

/** Wires the update/setStatus/publish mutations for one listing, each
 *  invalidating the list and detail queries for `organisationId`/`id` on success. */
export function useListingDetailMutations(
  id: string | undefined,
  organisationId: string | null,
  organisationName: string | null,
): UseListingDetailMutationsResult {
  const queryClient = useQueryClient();

  const invalidate = (): void => {
    queryClient.invalidateQueries({ queryKey: ['estate-agent-listings', organisationId] });
    queryClient.invalidateQueries({ queryKey: ['estate-agent-listing', id] });
  };

  const updateMutation = useMutation({
    mutationFn: (patch: UpdatePatch) => estateAgentListingsService.update(id!, patch),
    onSuccess: invalidate,
  });
  const statusMutation = useMutation({
    mutationFn: (status: AgentListingStatus) => estateAgentListingsService.setStatus(id!, status),
    onSuccess: invalidate,
  });
  const publishMutation = useMutation({
    // Belt-and-braces: the header disables Publish while the name is still
    // loading, but never fall back to '' here — an empty agency name bakes a
    // degenerate slug ("-sg19-abc123") that can't be fixed after the fact,
    // since a listing's slug is assigned once and never regenerated.
    //
    // Persists the currently merged material_info before flipping the
    // listing public, so a never-saved panel can't go live still showing
    // "Not yet provided" for price/tenure.
    mutationFn: async (materialInfo: MaterialInfo) => {
      if (!organisationName) {
        return Promise.reject(new Error('Cannot publish before the agency name has loaded'));
      }
      await estateAgentListingsService.update(id!, { material_info: materialInfo });
      return estateAgentListingsService.publish(id!, organisationName);
    },
    onSuccess: invalidate,
  });

  return { updateMutation, statusMutation, publishMutation };
}
