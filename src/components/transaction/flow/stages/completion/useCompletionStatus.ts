// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useCallback, useEffect, useRef, useState } from 'react';
import { icpService } from '@/services/icp.service';
import { isCompletedStatus } from '@/services/completionStatus';
import { logger } from '@/utils/logger';
import type { CompletionStatus } from '@/services/completionStatus';

export type CompletionLoadState = 'loading' | 'ready' | 'failed';

/** How often the stage re-reads the canister while completion is pending. */
export const COMPLETION_POLL_MS = 20_000;

export interface UseCompletionStatusResult {
  status: CompletionStatus | null;
  loadState: CompletionLoadState;
  /** Re-read from the canister; resolves the fresh status (null on failure). */
  reload: () => Promise<CompletionStatus | null>;
}

/**
 * The canister's completion record for a deal. Read on mount, then every
 * 20 seconds and whenever the window regains focus until the deal has
 * completed, so each side's confirmation appears without a refresh.
 */
export function useCompletionStatus(transactionId: string | undefined): UseCompletionStatusResult {
  const [status, setStatus] = useState<CompletionStatus | null>(null);
  const [loadState, setLoadState] = useState<CompletionLoadState>('loading');
  const mounted = useRef(true);
  const completed = isCompletedStatus(status?.status);

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

  useEffect(() => {
    if (completed || !transactionId) return undefined;
    const refresh = (): void => { void reload(); };
    const timer = window.setInterval(refresh, COMPLETION_POLL_MS);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [completed, transactionId, reload]);

  return { status, loadState, reload };
}
