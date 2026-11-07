// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useEffect, useState } from 'react';
import { readCompletionStatements } from '@/lib/completionStatement';
import { logger } from '@/utils/logger';
import type { CompletionStatementRecord } from '@/lib/completionStatement';

export type StatementLoad =
  | { state: 'loading' }
  | { state: 'failed' }
  | { state: 'ready'; statements: CompletionStatementRecord[] };

/** The seller's conveyancer's completion statements, read once when the stage opens. */
export function useCompletionStatement(
  transactionId: string | undefined,
  sellerConveyancer: string | null | undefined,
): StatementLoad {
  const [load, setLoad] = useState<StatementLoad>({ state: 'loading' });

  useEffect(() => {
    let active = true;
    if (!transactionId || !sellerConveyancer) {
      setLoad({ state: 'ready', statements: [] });
      return undefined;
    }
    setLoad({ state: 'loading' });
    readCompletionStatements(transactionId, sellerConveyancer)
      .then((statements) => { if (active) setLoad({ state: 'ready', statements }); })
      .catch((e: unknown) => {
        logger.warn('[completion] could not read the completion statement', e);
        if (active) setLoad({ state: 'failed' });
      });
    return () => { active = false; };
  }, [transactionId, sellerConveyancer]);

  return load;
}
