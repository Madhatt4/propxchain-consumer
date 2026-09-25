// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The stalls for a whole desk of matters, keyed by transaction id. One
 * caller-scoped read per matter, in parallel; a matter that cannot be read
 * (not a party yet, transient error) is an empty list, never a broken list.
 */
import { useEffect, useState } from 'react';
import { loadDealStalls, type DealStall } from '@/services/stall.service';
import { logger } from '@/utils/logger';

export function useDealStalls(transactionIds: readonly string[]): Record<string, DealStall[]> {
  const [byTx, setByTx] = useState<Record<string, DealStall[]>>({});
  // A joined key so a fresh array of the same ids does not refetch.
  const key = transactionIds.join('|');

  useEffect(() => {
    let active = true;
    const ids = key ? key.split('|') : [];
    void Promise.all(
      ids.map(async (id) => {
        const stalls = await loadDealStalls(id).catch((error: unknown) => {
          logger.warn(`Stalls unavailable for ${id}`, error);
          return [] as DealStall[];
        });
        return [id, stalls] as const;
      }),
    ).then((pairs) => {
      if (active) setByTx(Object.fromEntries(pairs));
    });
    return () => {
      active = false;
    };
  }, [key]);

  return byTx;
}
