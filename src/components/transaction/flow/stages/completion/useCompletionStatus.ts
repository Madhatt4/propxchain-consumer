// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useCallback, useEffect, useRef, useState } from 'react';
import { icpService } from '@/services/icp.service';
import type { CompletionStatus } from '@/services/completionStatus';
import { logger } from '@/utils/logger';

export type CompletionLoadState = 'loading' | 'ready' | 'failed';

export interface UseCompletionStatusResult {
  status: CompletionStatus | null;
  loadState: CompletionLoadState;
  /** Re-read from the canister; resolves the fresh status (null on failure). */
  reload: () => Promise<CompletionStatus | null>;
}

/** The canister's completion record for a deal, read on mount and on demand. */
export function useCompletionStatus(transactionId: string | undefined): UseCompletionStatusResult {
  const [status, setStatus] = useState<CompletionStatus | null>(null);
  const [loadState, setLoadState] = useState<CompletionLoadState>('loading');
  const mounted = useRef(true);

  const reload = useCallback(async (): Promise<CompletionStatus | null> => {
    if (!transactionId) {
      setLoadState('ready');
      return null;
    }
    try {
      const next = await icpService.getCompletionStatus(transactionId);
      if (mounted.current) {
        setStatus(next);
        setLoadState('ready');
      }
      return next;
    } catch (err: unknown) {
      logger.warn('[completion] could not read completion status', err);
      if (mounted.current) setLoadState('failed');
      return null;
    }
  }, [transactionId]);

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  return { status, loadState, reload };
}
