// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The 4-step checklist plus success/failed panel shown once StartSaleModal
 * leaves the form phase. Step 4 (invite email) is best-effort: a step-4
 * failure still renders inside the success panel with a "Re-send" action,
 * rather than the whole modal going to the failed phase.
 */

import { Check, X, Loader2 } from 'lucide-react';
import type { StartSaleResult } from '@/services/startSale.service';
import type { ModalPhase, StepState } from '@/components/estate-agent/startSaleProgress.types';

const STEP_LABELS: Record<number, string> = {
  1: 'Creating the sale record',
  2: 'Registering you on the deal',
  3: 'Linking the listing',
  4: 'Emailing the seller',
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
      return <span className="inline-block h-4 w-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />;
  }
}

function StepList({ steps }: { steps: Record<number, StepState> }): JSX.Element {
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
                    ? 'text-gray-900 dark:text-gray-50'
                    : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {STEP_LABELS[n]}
            </span>
            {step.error && <span className="font-[DM_Sans] text-xs text-[#EF4444]">— {step.error}</span>}
          </li>
        );
      })}
    </ul>
  );
}

interface EmailStatusProps {
  step4: StepState;
  sellerEmail: string | null;
  resendStatus: 'idle' | 'sending' | 'error';
  onResend: () => void;
}

function EmailStatus({ step4, sellerEmail, resendStatus, onResend }: EmailStatusProps): JSX.Element {
  if (step4.status === 'failed') {
    return (
      <div className="mt-2 space-y-1">
        <p className="font-[DM_Sans] text-xs text-[#EF4444]">Invite email failed — {step4.error}</p>
        <button
          type="button"
          onClick={onResend}
          disabled={resendStatus === 'sending'}
          className="rounded-md border border-[#0D9488] px-3 py-1.5 font-[DM_Sans] text-xs font-medium text-[#0D9488] hover:bg-[#CCFBF1] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#042F2E]"
        >
          {resendStatus === 'sending' ? 'Sending…' : 'Re-send'}
        </button>
        {resendStatus === 'error' && <p className="font-[DM_Sans] text-xs text-[#EF4444]">Re-send failed — try again.</p>}
      </div>
    );
  }
  return <p className="mt-2 font-[DM_Sans] text-xs text-[#0D9488]">Invite emailed to {sellerEmail}</p>;
}

interface ResultSummaryProps {
  result: StartSaleResult;
  step4: StepState;
  sellerEmail: string | null;
  resendStatus: 'idle' | 'sending' | 'error';
  onResend: () => void;
}

/** The success-phase transaction code + invite-email status card. */
function ResultSummary({ result, step4, sellerEmail, resendStatus, onResend }: ResultSummaryProps): JSX.Element {
  return (
    <div className="rounded-md bg-[#CCFBF1] p-3 dark:bg-[#042F2E]">
      <p className="font-[DM_Sans] text-xs font-medium text-[#0D9488]">Transaction code:</p>
      <p className="mt-1 font-[Geist_Mono] text-lg font-bold tracking-wider text-gray-900 dark:text-gray-50">
        {result.inviteCode}
      </p>
      <EmailStatus step4={step4} sellerEmail={sellerEmail} resendStatus={resendStatus} onResend={onResend} />
    </div>
  );
}

interface FooterActionsProps {
  phase: ModalPhase;
  onRetry: () => void;
  onClose: () => void;
  onDone: () => void;
}

/** The failed-phase Close/Retry pair, or the success-phase Done button. */
function FooterActions({ phase, onRetry, onClose, onDone }: FooterActionsProps): JSX.Element {
  return (
    <div className="flex items-center justify-end gap-3">
      {phase === 'failed' && (
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 font-[DM_Sans] text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
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
  );
}

export interface StartSaleProgressPanelProps {
  phase: ModalPhase;
  steps: Record<number, StepState>;
  result: StartSaleResult | null;
  sellerEmail: string | null;
  resendStatus: 'idle' | 'sending' | 'error';
  onResend: () => void;
  onRetry: () => void;
  onClose: () => void;
  onDone: () => void;
}

export default function StartSaleProgressPanel({
  phase,
  steps,
  result,
  sellerEmail,
  resendStatus,
  onResend,
  onRetry,
  onClose,
  onDone,
}: StartSaleProgressPanelProps): JSX.Element {
  return (
    <div className="space-y-5">
      <StepList steps={steps} />
      {phase === 'success' && result && (
        <ResultSummary result={result} step4={steps[4]} sellerEmail={sellerEmail} resendStatus={resendStatus} onResend={onResend} />
      )}
      <FooterActions phase={phase} onRetry={onRetry} onClose={onClose} onDone={onDone} />
    </div>
  );
}
