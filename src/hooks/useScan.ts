// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * React Query hooks for the three AI scans. HMLR is a read (the scan is warmed
 * at pull time and cached server-side), so it's a query keyed on the
 * transaction. Search and survey are user-triggered against a manually-uploaded
 * PDF, so they're mutations.
 */

import { useMutation, useQuery, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { hmlrTitleService } from '../services/hmlrTitle.service';
import {
  getHmlrScan,
  runSearchScan,
  runSurveyScan,
  type RunSearchScanInput,
  type RunSurveyScanInput,
} from '../services/scan.service';
import {
  fetchReturnedOneSearchResults,
  type ReturnedOneSearchSearch,
} from '../services/onesearchResults';
import { normalizeHmlrToContract, type ScanResult, type ScanRunResult } from '../types/scan.types';

/**
 * Read the AI HMLR scan for a transaction's already-pulled register. Resolves
 * to null when no register has been pulled yet or the scan has no data — the
 * panel renders an empty/prompt state in that case.
 */
export function useHmlrScan(transactionId: string): UseQueryResult<ScanResult | null> {
  return useQuery({
    queryKey: queryKeys.scans.hmlr(transactionId),
    queryFn: async (): Promise<ScanResult | null> => {
      const register = await hmlrTitleService.getStoredRegisterForTransaction(transactionId);
      if (!register) return null;
      const scan = await getHmlrScan(register, transactionId);
      return scan ? normalizeHmlrToContract(scan) : null;
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

/**
 * OneSearch orders on this transaction whose results have come back. Drives the
 * "your searches are back — scan them" path, so the user never has to notice a
 * returned search themselves or re-download it to upload it again.
 */
export function useReturnedOneSearchResults(
  transactionId: string,
): UseQueryResult<ReturnedOneSearchSearch[]> {
  return useQuery({
    queryKey: [...queryKeys.scans.all, 'onesearch-returned', transactionId],
    queryFn: () => fetchReturnedOneSearchResults(transactionId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSearchScan(): UseMutationResult<ScanRunResult | null, Error, RunSearchScanInput> {
  return useMutation({
    mutationKey: [...queryKeys.scans.all, 'search'],
    mutationFn: (input: RunSearchScanInput) => runSearchScan(input),
  });
}

export function useSurveyScan(): UseMutationResult<ScanRunResult | null, Error, RunSurveyScanInput> {
  return useMutation({
    mutationKey: [...queryKeys.scans.all, 'survey'],
    mutationFn: (input: RunSurveyScanInput) => runSurveyScan(input),
  });
}
