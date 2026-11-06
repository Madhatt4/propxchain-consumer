// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useEffect, useState } from 'react';
import { readCompletionStatement } from '@/lib/completionStatement';
import { logger } from '@/utils/logger';
import type { CompletionStatementRecord } from '@/lib/completionStatement';

/** undefined while loading or when the trail could not be read; null when there is none. */
export type LoadedStatement = CompletionStatementRecord | null | undefined;

/** The seller's conveyancer's completion statement, read once when the stage opens. */
export function useCompletionStatement(
  transactionId: string | undefined,
  sellerConveyancer: string | null | undefined,
): LoadedStatement {
  const [statement, setStatement] = useState<LoadedStatement>(undefined);

  useEffect(() => {
    let active = true;
    if (!transactionId || !sellerConveyancer) {
      setStatement(null);
      return undefined;
    }
    readCompletionStatement(transactionId, sellerConveyancer)
      .then((s) => { if (active) setStatement(s); })
      .catch((e: unknown) => logger.warn('[completion] could not read the completion statement', e));
    return () => { active = false; };
  }, [transactionId, sellerConveyancer]);

  return statement;
}
