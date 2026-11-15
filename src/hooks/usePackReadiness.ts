// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * Shared by the Sales pack tab and the Overview chip so both read one
 * cached answer — react-query dedupes the nine underlying source calls.
 */
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { loadPackReadiness, type PackReadiness } from '@/services/salesPackReadiness';

function readinessKey(transactionId: string | undefined): string[] {
  return ['salesPack', 'readiness', transactionId ?? ''];
}

export function usePackReadiness(transactionId: string | undefined): {
  readiness: PackReadiness | undefined;
  isLoading: boolean;
} {
  const query = useQuery({
    queryKey: readinessKey(transactionId),
    queryFn: () => loadPackReadiness(transactionId as string),
    enabled: Boolean(transactionId),
    staleTime: 2 * 60 * 1000,
  });
  return { readiness: query.data, isLoading: query.isLoading };
}

/** Re-read the pack after the seller completes a step from inside it. */
export function useRefreshPackReadiness(transactionId: string): () => void {
  const client = useQueryClient();
  return useCallback(() => {
    void client.invalidateQueries({ queryKey: readinessKey(transactionId) });
  }, [client, transactionId]);
}
