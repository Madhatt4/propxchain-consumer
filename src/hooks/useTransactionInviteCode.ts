// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Derives a transaction's shareable invite code from its party_invites
 * rows — every invite for a transaction is minted with the same on-chain
 * code (createTransactionWithInvite mints it once), so the first row's
 * invite_code is the transaction's code. Shares the ['tx-invites', …]
 * query key with ListingPartiesSection, so this never double-fetches once
 * that section is mounted alongside it.
 */

import { useQuery } from '@tanstack/react-query';

import { partyInviteService } from '@/services/partyInvite.service';

export function useTransactionInviteCode(transactionId: string | null): string | null {
  const { data } = useQuery({
    queryKey: ['tx-invites', transactionId],
    enabled: !!transactionId,
    queryFn: () => partyInviteService.listForTransaction(transactionId!),
  });
  return data?.[0]?.invite_code ?? null;
}
