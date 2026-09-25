// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * Shared by the Sales pack tab and the Overview chip so both read one
 * cached answer — react-query dedupes the nine underlying source calls.
 */
import { useQuery } from '@tanstack/react-query';
import { loadPackReadiness, type PackReadiness } from '@/services/salesPackReadiness';

export function usePackReadiness(transactionId: string | undefined): {
  readiness: PackReadiness | undefined;
  isLoading: boolean;
} {
  const query = useQuery({
    queryKey: ['salesPack', 'readiness', transactionId ?? ''],
    queryFn: () => loadPackReadiness(transactionId as string),
    enabled: Boolean(transactionId),
    staleTime: 2 * 60 * 1000,
  });
  return { readiness: query.data, isLoading: query.isLoading };
}
