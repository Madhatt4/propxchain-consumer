// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * CheckMyAnswers — the seller's "Check my answers" control for one saved TA6
 * or TA10, and the panel it reveals.
 *
 * Advisory by construction: this component owns a button and some local
 * state, nothing else. It never gates the stage's submit button, and the
 * result lives in component state only — the check is a moment's advice on
 * the answers as they stand, not a record, so nothing is cached, persisted or
 * written back anywhere.
 */
import { useState } from 'react';
import type { ReactElement } from 'react';
import { Sparkles } from 'lucide-react';

import { FormCheckError, checkForm } from '@/services/formCheck.service';
import type { FormCheckForm, FormCheckResult } from '@/services/formCheck.service';
import { logger } from '@/utils/logger';

import { CheckMyAnswersPanel } from './CheckMyAnswersPanel';
import type { FormNavState } from './CheckMyAnswersPanel';

export interface CheckMyAnswersProps {
  transactionId: string;
  form: FormCheckForm;
  navState?: FormNavState;
}

/**
 * The function returns every failure as a real status, so the seller is told
 * which of them happened rather than "something went wrong". A 404 is the
 * common one and is not an error in the seller's eyes: it means the answers
 * this stage thinks are saved are not readable on chain yet.
 */
function messageFor(error: unknown): string {
  if (!(error instanceof FormCheckError)) return 'Could not run the check. Please try again.';
  switch (error.status) {
    case 403:
      return 'Only the seller and their conveyancer can check this form.';
    case 404:
      return 'There are no saved answers to check yet. Save the form first.';
    case 429:
      return error.resetIn === undefined
        ? 'You have run a few checks in quick succession. Please wait a moment.'
        : `You have run a few checks in quick succession. Try again in ${error.resetIn}s.`;
    case 503:
      return 'The check is unavailable at the moment. Please try again later.';
    default:
      return 'Could not run the check. Please try again.';
  }
}

interface CheckButtonProps {
  isChecking: boolean;
  hasResult: boolean;
  onCheck: () => void;
}

function CheckButton({ isChecking, hasResult, onCheck }: CheckButtonProps): ReactElement {
  return (
    <button
      type="button"
      disabled={isChecking}
      onClick={onCheck}
      className="flex items-center gap-1.5 rounded-lg border border-teal-300 bg-white px-3 py-1.5 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-50 disabled:opacity-50 dark:border-teal-700 dark:bg-slate-800 dark:text-teal-300 dark:hover:bg-teal-900/30"
    >
      {isChecking ? (
        <>
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-b-2 border-teal-600" />
          Checking…
        </>
      ) : (
        <>
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          {hasResult ? 'Check again' : 'Check my answers'}
        </>
      )}
    </button>
  );
}

export function CheckMyAnswers({ transactionId, form, navState }: CheckMyAnswersProps): ReactElement {
  const [result, setResult] = useState<FormCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async (): Promise<void> => {
    setIsChecking(true);
    setError(null);
    try {
      setResult(await checkForm(transactionId, form));
    } catch (err) {
      // The previous result stays on screen: losing it would punish a retry.
      setError(messageFor(err));
      logger.warn('[check-my-answers] check failed', err);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="px-4 pb-3">
      <CheckButton isChecking={isChecking} hasResult={result !== null} onCheck={() => void handleCheck()} />

      {error !== null && (
        <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {result !== null && (
        <CheckMyAnswersPanel transactionId={transactionId} result={result} navState={navState} />
      )}
    </div>
  );
}

export default CheckMyAnswers;
