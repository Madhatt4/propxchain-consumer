// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Reservation progress modal — form entry then 4-step checklist.
 */

import { useState, useCallback } from 'react';
import { Check, X, Loader2 } from 'lucide-react';

import ReservePlotForm from '@/components/builder/ReservePlotForm';
import {
  reservationService,
  type ReservationProgress,
} from '@/services/reservation.service';

interface ReservePlotModalProps {
  isOpen: boolean;
  siteId: string;
  plotId: string;
  plotNumber: string;
  inviteCode?: string | null;
  onClose: () => void;
  onComplete: () => void;
}

type ModalPhase = 'form' | 'progress' | 'success' | 'failed';

interface StepState {
  status: 'waiting' | 'pending' | 'success' | 'failed';
  error?: string;
}

const STEP_LABELS: Record<number, string> = {
  1: 'Creating reservation',
  2: 'Recording on chain',
  3: 'Saving snapshot',
  4: 'Sending invite',
};

function StepIcon({ status }: { status: StepState['status'] }): JSX.Element {
  switch (status) {
    case 'success':
      return <Check className="h-4 w-4 text-[#10B981]" />;
    case 'failed':
      return <X className="h-4 w-4 text-[#EF4444]" />;
    case 'pending':
      return <Loader2 className="h-4 w-4 animate-spin text-[#0D9488]" />;
    default:
      return (
        <span className="inline-block h-4 w-4 rounded-full border-2 border-[var(--border-color)]" />
      );
  }
}

function StepList({
  steps,
}: {
  steps: Record<number, StepState>;
}): JSX.Element {
  return (
    <ul className="space-y-3">
      {[1, 2, 3, 4].map((n) => {
        const step = steps[n];
        return (
          <li key={n} className="flex items-center gap-3">
            <StepIcon status={step.status} />
            <span
              className={`font-[DM_Sans] text-sm ${
                step.status === 'failed'
                  ? 'text-[#EF4444]'
                  : step.status === 'success'
                    ? 'text-[var(--text-main)]'
                    : 'text-[var(--text-secondary)]'
              }`}
            >
              {STEP_LABELS[n]}
            </span>
            {step.error && (
              <span className="font-[DM_Sans] text-xs text-[#EF4444]">
                — {step.error}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ProgressContent({
  steps,
  phase,
  inviteToken,
  existingInviteCode,
  onRetry,
  onClose,
  onDone,
}: {
  steps: Record<number, StepState>;
  phase: ModalPhase;
  inviteToken: string | null;
  existingInviteCode?: string | null;
  onRetry: () => void;
  onClose: () => void;
  onDone: () => void;
}): JSX.Element {
  return (
    <div className="space-y-5">
      <StepList steps={steps} />

      {phase === 'success' && (
        <div className="rounded-md bg-[#CCFBF1] p-3 dark:bg-[#042F2E]">
          <p className="font-[DM_Sans] text-xs font-medium text-[#0D9488]">
            Invite code (share with buyer):
          </p>
          <p className="mt-1 font-[Geist_Mono] text-lg font-bold tracking-wider text-[var(--text-main)]">
            {existingInviteCode ?? inviteToken}
          </p>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {phase === 'failed' && (
          <>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2 font-[DM_Sans] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-section)]"
            >
              Close
            </button>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md bg-[#0D9488] px-4 py-2 font-[DM_Sans] text-sm font-medium text-white hover:bg-[#0F766E]"
            >
              Retry
            </button>
          </>
        )}
        {phase === 'success' && (
          <button
            type="button"
            onClick={onDone}
            className="rounded-md bg-[#84A98C] px-4 py-2 font-[DM_Sans] text-sm font-medium text-white hover:bg-[#5F8A68]"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}

function initialSteps(): Record<number, StepState> {
  return {
    1: { status: 'waiting' },
    2: { status: 'waiting' },
    3: { status: 'waiting' },
    4: { status: 'waiting' },
  };
}

export default function ReservePlotModal({
  isOpen,
  siteId,
  plotId,
  plotNumber,
  inviteCode: existingInviteCode,
  onClose,
  onComplete,
}: ReservePlotModalProps): JSX.Element | null {
  const [phase, setPhase] = useState<ModalPhase>('form');
  const [steps, setSteps] = useState<Record<number, StepState>>(initialSteps);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [lastInput, setLastInput] = useState<{
    buyerName: string;
    buyerEmail: string;
  } | null>(null);

  const runSaga = useCallback(
    async (buyerName: string, buyerEmail: string): Promise<void> => {
      setPhase('progress');
      setSteps(initialSteps());
      setInviteToken(null);
      setLastInput({ buyerName, buyerEmail });

      const handleProgress = (p: ReservationProgress): void => {
        setSteps((prev) => ({
          ...prev,
          [p.step]: { status: p.status, error: p.error },
        }));
      };

      try {
        const result = await reservationService.reservePlot(
          { plotId, siteId, buyerName, buyerEmail },
          handleProgress,
        );
        setInviteToken(result.inviteToken);
        setPhase('success');
      } catch {
        setPhase('failed');
      }
    },
    [plotId, siteId],
  );

  const handleFormComplete = useCallback(
    (buyerName: string, buyerEmail: string): void => {
      runSaga(buyerName, buyerEmail);
    },
    [runSaga],
  );

  const handleRetry = useCallback((): void => {
    if (lastInput) {
      runSaga(lastInput.buyerName, lastInput.buyerEmail);
    }
  }, [lastInput, runSaga]);

  const handleDone = useCallback((): void => {
    setPhase('form');
    setSteps(initialSteps());
    setInviteToken(null);
    onComplete();
  }, [onComplete]);

  const handleClose = useCallback((): void => {
    setPhase('form');
    setSteps(initialSteps());
    setInviteToken(null);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={phase === 'form' ? handleClose : undefined}
        role="presentation"
      />

      {/* Card */}
      <div className="relative mx-4 w-full max-w-md rounded-xl bg-[var(--bg-card)] p-6 shadow-xl">
        <h2 className="font-[Fraunces] text-xl font-semibold text-[var(--text-main)]">
          Reserve {plotNumber}
        </h2>
        <p className="mt-1 font-[DM_Sans] text-sm text-[var(--text-secondary)]">
          {phase === 'form'
            ? 'Enter buyer details to begin the reservation.'
            : 'Processing reservation...'}
        </p>

        <div className="mt-5">
          {phase === 'form' ? (
            <ReservePlotForm
              siteId={siteId}
              plotId={plotId}
              onComplete={handleFormComplete}
              onCancel={handleClose}
            />
          ) : (
            <ProgressContent
              steps={steps}
              phase={phase}
              inviteToken={inviteToken}
              existingInviteCode={existingInviteCode}
              onRetry={handleRetry}
              onClose={handleClose}
              onDone={handleDone}
            />
          )}
        </div>
      </div>
    </div>
  );
}
