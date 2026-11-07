// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useEffect, useRef } from 'react';
import { isCompletedStatus } from '@/services/completionStatus';
import { completionHashInputOf } from '@/utils/completionHashes';
import { useCompletionStatus } from './completion/useCompletionStatus';
import { useCompletionActions } from './completion/useCompletionActions';
import { useCompletionStatement } from './completion/useCompletionStatement';
import { CompletionStatementLines, noStatementWarningOf, statementViewOf } from './completion/CompletionStatementLines';
import { CompletionRows } from './completion/CompletionRows';
import { CompletionCertificate } from './completion/CompletionCertificate';
import type { ReactNode } from 'react';
import type { KeysRole } from '@/lib/completionRoles';
import type { StageConfig, JourneyRole } from '../../../../types/stage.types';

interface StageProps {
  stage: StageConfig;
  /** Told once the canister reports completion, so the stage shows as done. */
  onComplete?: (stageId: string) => void;
  journeyRole?: JourneyRole;
  /** The viewer's actual side; falls back to the journey being shown. */
  viewerRole?: JourneyRole;
  /** The viewer is a buyer or seller party, not a delegate such as the agent. */
  viewerIsParty?: boolean;
  transactionId?: string;
  propertyAddress?: string;
  /** Agreed price from the canister, anchored in the completion hashes. */
  purchasePrice?: number;
  keysRole?: KeysRole;
  /** The seller's conveyancer on the deal, who uploads the completion statement. */
  sellerConveyancer?: string | null;
}

const INTRO =
  "On completion day the buyer's conveyancer sends the money and the seller's conveyancer confirms it has arrived. PropXchain records each confirmation; it never moves money.";

function StatusMessage({ failed }: { failed: boolean }): ReactNode {
  return (
    <p className="text-sm text-gray-600 dark:text-slate-300">
      {failed
        ? 'Could not load completion from PropXchain. Please refresh the page to try again.'
        : 'Completion is not available for this transaction.'}
    </p>
  );
}

function ErrorLine({ message }: { message: string }): ReactNode {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300"
    >
      {message}
    </div>
  );
}

/**
 * Completion is done by the conveyancers; PropXchain only records it. Every
 * row is read from transaction_manager, never from local ticks, and the
 * canister decides who may confirm what.
 */
export function CompletionStage({
  stage, onComplete, journeyRole = 'seller', viewerRole, viewerIsParty = false,
  transactionId, propertyAddress, purchasePrice, keysRole = 'none', sellerConveyancer = null,
}: StageProps): ReactNode {
  const { status, loadState, reload } = useCompletionStatus(transactionId);
  const completed = isCompletedStatus(status?.status);
  const hashInput = completionHashInputOf(transactionId, propertyAddress, purchasePrice);
  const actions = useCompletionActions({ transactionId, hashInput, sellerConveyancer, wasCompleted: completed, reload });
  const statementLoad = useCompletionStatement(transactionId, sellerConveyancer);
  const reported = useRef(false);

  useEffect(() => {
    if (completed && stage.status !== 'completed' && !reported.current) {
      reported.current = true;
      onComplete?.(stage.id);
    }
  }, [completed, stage.status, stage.id, onComplete]);

  if (loadState === 'loading') {
    return <p className="text-sm text-gray-500 dark:text-slate-400">Loading completion from PropXchain…</p>;
  }
  if (loadState === 'failed' || !status) return <StatusMessage failed={loadState === 'failed'} />;
  const view = statementViewOf(statementLoad, status);

  return (
    <div className="flex flex-col gap-4">
      {completed
        ? <CompletionCertificate journeyRole={journeyRole} transactionId={transactionId} status={status} />
        : <p className="text-sm text-gray-600 dark:text-slate-300">{INTRO}</p>}
      {sellerConveyancer && <CompletionStatementLines load={statementLoad} view={view} status={status} />}
      {actions.error && <ErrorLine message={actions.error} />}
      <CompletionRows
        status={status}
        viewerSide={viewerRole ?? journeyRole}
        viewerIsParty={viewerIsParty}
        isMissingDealFacts={hashInput === null}
        keysRole={keysRole}
        completed={completed}
        busy={actions.busy}
        confirmNote={noStatementWarningOf(view, sellerConveyancer)}
        onConfirmSide={actions.confirmSide}
        onConfirmKeys={actions.confirmKeys}
      />
      {completed && journeyRole === 'buyer' && (
        <p className="text-xs text-gray-400 dark:text-slate-500">
          Legal title transfers when HM Land Registry processes the AP1 registration.
        </p>
      )}
    </div>
  );
}
