// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * All StartSaleModal state + saga orchestration, extracted so the modal's
 * own component body stays under the 50-line declaration-to-close budget.
 * Mirrors builder/ReservePlotModal's phase/runSaga/handleRetry shape;
 * step 4 (invite email) is best-effort, so a step-4 failure still lands on
 * the success panel with a "Re-send" action rather than the failed phase.
 *
 * Retry resumes rather than restarts (#251): the ids step 1 reported are
 * kept in a ref and handed back to the saga, so a failure in step 2 or 3
 * does not mint a second on-chain transaction and orphan the first.
 *
 * Double-submit guard: `isSubmittingRef` is checked and set synchronously
 * at the top of runSaga, before any await or state update, so two rapid
 * submits (form re-click, or retry racing a still-running saga) can never
 * both invoke startSaleService.startSale.
 */

import { useCallback, useRef, useState } from 'react';

import { startSaleService, type StartSaleProgress, type StartSaleResult } from '@/services/startSale.service';
import { partyInviteService } from '@/services/partyInvite.service';
import { clearPendingStartSale, loadPendingStartSale, savePendingStartSale } from '@/services/startSalePending';
import type { AgentListingRow } from '@/types/estateAgentListing.types';
import { initialSteps, type ModalPhase, type StepState } from '@/components/estate-agent/startSaleProgress.types';

interface LastInput {
  sellerName: string;
  sellerEmail: string;
}

type SetSteps = React.Dispatch<React.SetStateAction<Record<number, StepState>>>;

/** runSaga + handleRetry, guarded against a double-submit by a ref checked
 *  and set synchronously before any await, so re-entrant calls are no-ops
 *  regardless of React's render/batching timing. Takes each setter as its
 *  own param (rather than a bundled state object) so its deps arrays stay
 *  exhaustive-deps clean. */
function useSagaRunner(
  listing: AgentListingRow,
  agentPrincipal: string,
  lastInput: LastInput | null,
  setPhase: (phase: ModalPhase) => void,
  setSteps: SetSteps,
  setResult: (result: StartSaleResult | null) => void,
  setResendStatus: (status: 'idle' | 'sending' | 'error') => void,
  setLastInput: (input: LastInput | null) => void,
): {
  /** Async: it runs the saga. Callers that only fire it can ignore the promise; tests await it. */
  runSaga: (sellerName: string, sellerEmail: string) => Promise<void>;
  handleRetry: () => void;
  isSubmitting: boolean;
  resetCreated: () => void;
} {
  const isSubmittingRef = useRef(false);
  // What step 1 minted for this listing, once it has. A ref, not state: every
  // submit reads it synchronously, and it must survive the re-render the failed
  // phase causes. The listing id rides along so ids minted for one listing can
  // never be resumed onto another, which would link an existing transaction to
  // the wrong property. Cleared only when the sale completes: while it holds a
  // value there is a transaction on chain that must not be minted twice, and
  // that is as true after closing the modal as it is on the Retry button.
  const createdRef = useRef<{ listingId: string; created: StartSaleResult } | null>(null);

  const runSaga = useCallback(
    async (sellerName: string, sellerEmail: string): Promise<void> => {
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      // Resume whatever step 1 already minted for THIS listing, however the
      // agent got back here: Retry, closing and starting again, or navigating
      // away and returning, which unmounts the hook and empties the ref (#251).
      const held = createdRef.current;
      const resume = (held && held.listingId === listing.id ? held.created : undefined)
        ?? loadPendingStartSale(listing.id)
        ?? undefined;
      setPhase('progress');
      setSteps(initialSteps());
      setResult(null);
      setResendStatus('idle');
      setLastInput({ sellerName, sellerEmail });

      const handleProgress = (p: StartSaleProgress): void => {
        if (p.created) {
          createdRef.current = { listingId: listing.id, created: p.created };
          savePendingStartSale(listing.id, p.created);
        }
        setSteps((prev) => ({ ...prev, [p.step]: { status: p.status, error: p.error } }));
      };

      try {
        const saleResult = await startSaleService.startSale(
          { listing, agentPrincipal, sellerName, sellerEmail, ...(resume ? { resume } : {}) },
          handleProgress,
        );
        setResult(saleResult);
        setPhase('success');
      } catch {
        setPhase('failed');
      } finally {
        isSubmittingRef.current = false;
      }
    },
    [listing, agentPrincipal, setPhase, setSteps, setResult, setResendStatus, setLastInput],
  );

  // Retry is just another submit: runSaga resumes from the ids it holds, so
  // the transaction step 1 already minted is never minted twice (#251).
  const handleRetry = useCallback((): void => {
    if (lastInput) void runSaga(lastInput.sellerName, lastInput.sellerEmail);
  }, [lastInput, runSaga]);

  const resetCreated = useCallback((): void => {
    createdRef.current = null;
    clearPendingStartSale(listing.id);
  }, [listing.id]);
  return { runSaga, handleRetry, isSubmitting: isSubmittingRef.current, resetCreated };
}

/** Re-sends the seller invite after a best-effort step-4 email failure. */
function useSagaResend(
  listing: AgentListingRow,
  result: StartSaleResult | null,
  lastInput: LastInput | null,
  setSteps: SetSteps,
  setResendStatus: (status: 'idle' | 'sending' | 'error') => void,
): { handleResend: () => void } {
  const handleResend = useCallback(async (): Promise<void> => {
    if (!result || !lastInput) return;
    setResendStatus('sending');
    const sendResult = await partyInviteService.send({
      transactionId: result.transactionId,
      inviteCode: result.inviteCode,
      role: 'seller',
      side: 'seller',
      recipientName: lastInput.sellerName,
      recipientEmail: lastInput.sellerEmail,
      listingId: listing.id,
      propertyAddress: listing.listing.address,
    });
    if (sendResult.ok) {
      setSteps((prev) => ({ ...prev, 4: { status: 'success' } }));
      setResendStatus('idle');
    } else {
      setResendStatus('error');
    }
  }, [result, lastInput, listing, setSteps, setResendStatus]);

  return { handleResend };
}

/**
 * The Done / Close callbacks, both of which reset back to the form phase.
 * Only Done forgets what step 1 minted: closing an unfinished attempt leaves
 * a transaction on chain, so reopening must resume it rather than mint a
 * second one (#251).
 */
function useSagaLifecycle(
  result: StartSaleResult | null,
  resetState: () => void,
  resetCreated: () => void,
  onComplete: (result: StartSaleResult) => void,
  onClose: () => void,
): { handleDone: () => void; handleClose: () => void } {
  const handleDone = useCallback((): void => {
    if (result) onComplete(result);
    resetCreated();
    resetState();
  }, [result, onComplete, resetCreated, resetState]);

  const handleClose = useCallback((): void => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  return { handleDone, handleClose };
}

export interface UseStartSaleSagaInput {
  listing: AgentListingRow;
  agentPrincipal: string;
  onComplete: (result: StartSaleResult) => void;
  onClose: () => void;
}

export interface UseStartSaleSagaResult {
  phase: ModalPhase;
  steps: Record<number, StepState>;
  result: StartSaleResult | null;
  sellerEmail: string | null;
  resendStatus: 'idle' | 'sending' | 'error';
  isSubmitting: boolean;
  /** Async: it runs the saga. Callers that only fire it can ignore the promise; tests await it. */
  runSaga: (sellerName: string, sellerEmail: string) => Promise<void>;
  handleRetry: () => void;
  handleResend: () => void;
  handleDone: () => void;
  handleClose: () => void;
}

/** Composes the runner + resend hooks over one set of phase/steps/result
 *  state, then adds the two callbacks (Done / Close) that also reset back
 *  to the form phase. */
export function useStartSaleSaga({
  listing,
  agentPrincipal,
  onComplete,
  onClose,
}: UseStartSaleSagaInput): UseStartSaleSagaResult {
  const [phase, setPhase] = useState<ModalPhase>('form');
  const [steps, setSteps] = useState<Record<number, StepState>>(initialSteps);
  const [result, setResult] = useState<StartSaleResult | null>(null);
  const [lastInput, setLastInput] = useState<LastInput | null>(null);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'error'>('idle');

  const { runSaga, handleRetry, isSubmitting, resetCreated } = useSagaRunner(
    listing,
    agentPrincipal,
    lastInput,
    setPhase,
    setSteps,
    setResult,
    setResendStatus,
    setLastInput,
  );
  const { handleResend } = useSagaResend(listing, result, lastInput, setSteps, setResendStatus);

  const resetState = useCallback((): void => {
    setPhase('form');
    setSteps(initialSteps());
    setResult(null);
    setLastInput(null);
    setResendStatus('idle');
  }, []);
  const { handleDone, handleClose } = useSagaLifecycle(result, resetState, resetCreated, onComplete, onClose);

  return {
    phase,
    steps,
    result,
    sellerEmail: lastInput?.sellerEmail ?? null,
    resendStatus,
    isSubmitting,
    runSaga,
    handleRetry,
    handleResend,
    handleDone,
    handleClose,
  };
}
