// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useState } from 'react';
import { icpService } from '@/services/icp.service';
import { isCompletedStatus } from '@/services/completionStatus';
import { documentShareService } from '@/services/documentShare.service';
import { buildCompletionHashes } from '@/utils/completionHashes';
import { readCompletionStatement } from '@/lib/completionStatement';
import { logger } from '@/utils/logger';
import type { CompletionStatus } from '@/services/completionStatus';
import type { CompletionHashInput } from '@/utils/completionHashes';

type ActionResult = { success: boolean; message: string };

export interface UseCompletionActionsResult {
  busy: boolean;
  /** The canister's refusal, shown as written. */
  error: string | null;
  confirmSide: () => void;
  confirmKeys: () => void;
}

interface Options {
  transactionId: string | undefined;
  /** Null when the price or address is missing; confirmSide then does nothing. */
  hashInput: CompletionHashInput | null;
  /** The seller's conveyancer, whose uploaded statement is the anchor. */
  sellerConveyancer?: string | null;
  wasCompleted: boolean;
  reload: () => Promise<CompletionStatus | null>;
}

/** The two writes the Completion stage makes, each followed by a re-read. */
export function useCompletionActions({
  transactionId, hashInput, sellerConveyancer, wasCompleted, reload,
}: Options): UseCompletionActionsResult {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: (txId: string) => Promise<ActionResult>): Promise<void> {
    if (!transactionId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await action(transactionId);
      if (!result.success) {
        setError(result.message);
        return;
      }
      const next = await reload();
      if (!wasCompleted && next && isCompletedStatus(next.status)) {
        // Shared documents stop being readable 14 days after completion.
        void documentShareService
          .scheduleExpiryForDeal(transactionId)
          .catch((e: unknown) => logger.warn('[completion] could not schedule share expiry', e));
      }
    } finally {
      setBusy(false);
    }
  }

  function confirmSide(): void {
    if (!hashInput) return;
    void run(async (txId) => {
      // Read at confirm time: the statement may have arrived since the page
      // loaded, and the canister keeps the first statement hash it is given.
      let statementHash: string | null;
      try {
        statementHash = (await readCompletionStatement(txId, sellerConveyancer))?.fileHash ?? null;
      } catch (e: unknown) {
        logger.warn('[completion] could not read the completion statement', e);
        return { success: false, message: 'Could not check for a completion statement. Please try again.' };
      }
      const { fundsHash, completionHash } = await buildCompletionHashes(hashInput, new Date(), statementHash);
      return icpService.initiateCompletion(txId, fundsHash, completionHash);
    });
  }

  function confirmKeys(): void {
    void run((txId) => icpService.confirmKeysReleased(txId));
  }

  return { busy, error, confirmSide, confirmKeys };
}
