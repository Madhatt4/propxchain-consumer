// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The two save handlers ListingDetailPage passes down to its sections,
 * extracted so the page's own body stays under the 50-line
 * declaration-to-close budget.
 */

import { useCallback } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';

import { buildMaterialInfo } from '@/utils/materialInfo';
import { estateAgentListingsService } from '@/services/estateAgentListings.service';
import type { MaterialInfo, MaterialInfoOverrides } from '@/types/materialInfo.types';
import type { PropertyListing, ProvenanceMap } from '@/types/listing.types';
import type { EpcCertificate } from '@/services/epc.service';

type UpdatePatch = Parameters<typeof estateAgentListingsService.update>[1];

export interface UseListingDetailHandlersResult {
  handleDetailsSave: (
    updated: PropertyListing,
    provenance: ProvenanceMap,
    agentUrl: string | null | undefined,
  ) => void;
  handleMaterialInfoSave: () => void;
}

export function useListingDetailHandlers(
  updateMutation: UseMutationResult<unknown, Error, UpdatePatch>,
  info: MaterialInfo,
  overrides: MaterialInfoOverrides,
  epc: EpcCertificate | null,
): UseListingDetailHandlersResult {
  const handleDetailsSave = useCallback(
    (updated: PropertyListing, provenance: ProvenanceMap, agentUrl: string | null | undefined): void => {
      // Rebuild material_info from the just-edited listing rather than
      // saving the stale merged view — otherwise the saved panel can lag
      // an edit to price/tenure/etc. until the agent separately hits
      // "Save material information".
      const rebuiltInfo = buildMaterialInfo(updated, epc, overrides);
      // Omit the column entirely when the form wasn't managing it. Sending
      // `null` here would blank an agency's saved URL on any save from a
      // surface that doesn't show the field.
      updateMutation.mutate({
        listing: updated,
        provenance,
        material_info: rebuiltInfo,
        ...(agentUrl === undefined ? {} : { agent_url: agentUrl }),
      });
    },
    [updateMutation, epc, overrides],
  );

  const handleMaterialInfoSave = useCallback((): void => {
    updateMutation.mutate({ material_info: info });
  }, [updateMutation, info]);

  return { handleDetailsSave, handleMaterialInfoSave };
}
