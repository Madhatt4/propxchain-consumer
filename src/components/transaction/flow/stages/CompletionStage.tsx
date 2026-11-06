// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { StageConfig, JourneyRole } from '../../../../types/stage.types';
import { icpService } from '@/services/icp.service';
import { isCompletedStatus } from '@/services/completionStatus';
import { documentShareService } from '@/services/documentShare.service';
import { buildCompletionHashes } from '@/utils/completionHashes';
import { logger } from '@/utils/logger';
import type { KeysRole } from '@/lib/completionRoles';
import { useCompletionStatus } from './completion/useCompletionStatus';
import { CompletionRows } from './completion/CompletionRows';
import { CompletionCertificate } from './completion/CompletionCertificate';

interface StageProps {
  stage: StageConfig;
  /** Told once the canister reports completion, so the stage shows as done. */
  onComplete?: (stageId: string) => void;
  journeyRole?: JourneyRole;
  /** The viewer's actual side; falls back to the journey being shown. */
  viewerRole?: JourneyRole;
  transactionId?: string;
  propertyAddress?: string;
  /** Agreed price, anchored in the completion hashes. */
  purchasePrice?: number;
  keysRole?: KeysRole;
}

/**
 * Completion is done by the conveyancers; PropXchain only records it. Every
 * row here is read from transaction_manager, never from local ticks, and the
 * canister decides who may confirm what. Its refusals are shown as written.
 */
export function CompletionStage({
  stage, onComplete, journeyRole = 'seller', viewerRole, transactionId,
  propertyAddress, purchasePrice, keysRole = 'none',
}: StageProps): ReactNode {
  const { status, loadState, reload } = useCompletionStatus(transactionId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reported = useRef(false);
  const completed = isCompletedStatus(status?.status);

  useEffect(() => {
    if (completed && stage.status !== 'completed' && !reported.current) {
      reported.current = true;
      onComplete?.(stage.id);
    }
  }, [completed, stage.status, stage.id, onComplete]);

  async function run(action: (txId: string) => Promise<{ success: boolean; message: string }>): Promise<void> {
    if (!transactionId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await action(transactionId);
      if (!result.success) {
        setError(result.message);
        return;
      }
      const wasCompleted = completed;
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
    void run(async (txId) => {
      const { fundsHash, completionHash } = await buildCompletionHashes({
        transactionId: txId,
        propertyAddress: propertyAddress ?? '',
        purchasePrice: purchasePrice ?? 0,
      });
      return icpService.initiateCompletion(txId, fundsHash, completionHash);
    });
  }

  function confirmKeys(): void {
    void run((txId) => icpService.confirmKeysReleased(txId));
  }

  if (loadState === 'loading') {
    return <p className="text-sm text-gray-500 dark:text-slate-400">Loading completion from PropXchain…</p>;
  }
  if (loadState === 'failed' || !status) {
    return (
      <p className="text-sm text-gray-600 dark:text-slate-300">
        {loadState === 'failed'
          ? 'Could not load completion from PropXchain. Please refresh the page to try again.'
          : 'Completion is not available for this transaction.'}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {completed && (
        <CompletionCertificate journeyRole={journeyRole} transactionId={transactionId} completedAt={status.seller?.at ?? null} />
      )}
      {!completed && (
        <p className="text-sm text-gray-600 dark:text-slate-300">
          On completion day the buyer&apos;s conveyancer sends the money and the seller&apos;s conveyancer
          confirms it has arrived. PropXchain records each confirmation; it never moves money.
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300"
        >
          {error}
        </div>
      )}
      <CompletionRows
        status={status}
        viewerSide={viewerRole ?? journeyRole}
        keysRole={keysRole}
        completed={completed}
        busy={busy}
        onConfirmSide={confirmSide}
        onConfirmKeys={confirmKeys}
      />
      {completed && journeyRole === 'buyer' && (
        <p className="text-xs text-gray-400 dark:text-slate-500 text-center">
          Legal title transfers when HM Land Registry processes the AP1 registration.
          This certificate confirms the transaction was completed on PropXchain.
        </p>
      )}
    </div>
  );
}
