// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The signed-in viewer's side on a deal, for pages outside the flow page
 * (the TA forms) that still have to follow lib/dealAccess. `null` while the
 * deal loads. If the deal can't be read the viewer counts as `other`, the
 * side with the least to act on.
 */
import { useQuery } from '@tanstack/react-query';
import { icpService } from '@/services/icp.service';
import { usePrincipalId } from '@/stores/authStore';
import { dealSideOf, principalsOf, type DealParties, type DealSide } from '@/lib/dealAccess';

async function loadParties(transactionId: string): Promise<DealParties | null> {
  const [tx, delegates] = await Promise.all([
    icpService.getTransaction(transactionId),
    icpService.getDelegates(transactionId),
  ]);
  if (!tx) return null;
  return {
    seller: tx.seller?.toString(),
    buyer: tx.buyer?.toString(),
    sellers: principalsOf(tx.sellers),
    buyers: principalsOf(tx.buyers),
    delegates,
  };
}

export function useDealSide(transactionId: string | null | undefined): DealSide | null {
  const principal = usePrincipalId();
  const { data, isError, isPending } = useQuery({
    queryKey: ['deal-parties', transactionId],
    enabled: Boolean(transactionId),
    queryFn: () => loadParties(transactionId as string),
  });
  if (isError) return 'other';
  if (!principal || isPending) return null;
  return data ? dealSideOf(data, principal) : 'other';
}
