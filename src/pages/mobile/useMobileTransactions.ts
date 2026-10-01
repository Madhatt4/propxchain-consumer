// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useQuery } from '@tanstack/react-query';
import { icpService } from '@/services/icp.service';
import type { Transaction } from '@/types/transaction.types';

/**
 * The signed-in user's transactions, for the phone home screen.
 *
 * Deliberately only the fetch the dashboard already does. The web dashboard
 * loads transactions through SplitPanelContext, which also starts document
 * polling; the phone home does not need that, so it asks the canister
 * directly. `getMyTransactions()` filters server-side by caller.
 */
export function useMobileTransactions() {
  return useQuery<Transaction[]>({
    queryKey: ['mobile', 'my-transactions'],
    queryFn: async () => {
      await icpService.initAuth();
      return (await icpService.getMyTransactions()) as Transaction[];
    },
    staleTime: 30_000,
  });
}
