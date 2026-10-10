// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * RemoveFormUpload — takes back a completed-form PDF a seller uploaded by
 * mistake from the stage card. Two clicks, never one: the first opens a short
 * confirmation, the second removes. Only the uploaded-PDF path is undone; a
 * form filled in online keeps its own Edit.
 *
 * The removal itself (bucket object, on-chain proof, the transaction's
 * "uploaded" flag) lives in completedFormUpload.service; this owns the
 * buttons and tells the stage when it is done.
 */
import { useState } from 'react';
import type { ReactElement } from 'react';
import { Trash2 } from 'lucide-react';

import { withdrawCompletedForm } from '@/services/completedFormUpload.service';
import type { CompletedFormId } from '@/services/completedFormUpload.service';
import { logger } from '@/utils/logger';

export interface RemoveFormUploadProps {
  transactionId: string;
  formId: CompletedFormId;
  /** The form's label for the confirmation wording, e.g. "TA6 Property Information Form". */
  formLabel: string;
  onRemoved: () => void;
}

const BUTTON_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50';

export function RemoveFormUpload({ transactionId, formId, formLabel, onRemoved }: RemoveFormUploadProps): ReactElement {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRemove = async (): Promise<void> => {
    setIsRemoving(true);
    setError(null);
    try {
      await withdrawCompletedForm(transactionId, formId);
      setIsConfirming(false);
      onRemoved();
    } catch (err) {
      logger.warn('[remove-form-upload] failed', err);
      setError(err instanceof Error ? err.message : 'Could not remove the upload. Please try again.');
    } finally {
      setIsRemoving(false);
    }
  };

  if (!isConfirming) {
    return (
      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={() => setIsConfirming(true)}
          className={`${BUTTON_CLASS} border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700`}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Remove upload
        </button>
      </div>
    );
  }

  return (
    <div className="mx-4 mb-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
      <p>
        Remove the PDF you uploaded as your {formLabel}? It will no longer count as your completed form and your
        conveyancer will not see it. You can upload another or fill the form in online.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isRemoving}
          onClick={() => void handleRemove()}
          className={`${BUTTON_CLASS} border-red-300 bg-white text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-slate-800 dark:text-red-300 dark:hover:bg-red-900/30`}
        >
          {isRemoving ? 'Removing…' : 'Yes, remove it'}
        </button>
        <button
          type="button"
          disabled={isRemoving}
          onClick={() => setIsConfirming(false)}
          className={`${BUTTON_CLASS} border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700`}
        >
          Keep it
        </button>
      </div>
      {error !== null && (
        <p role="alert" className="text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

export default RemoveFormUpload;
