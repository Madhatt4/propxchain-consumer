import React from 'react';

import { AnswerButtons } from './AnswerButtons';
import { PromptHeader } from './PromptHeader';
import type { TA6PromptEntry } from './types';
import type { TA6AnswerValue, TA6ResponseValue } from '../../../../types/ta6.types';

export interface ResponseFieldProps {
  /** TA6 question reference, e.g. '2.3'. */
  refCode: string;
  /** Paraphrased prompt from the wording bundle; undefined renders the ref chip only. */
  prompt: TA6PromptEntry | undefined;
  value: TA6ResponseValue;
  onChange: (value: TA6ResponseValue) => void;
  readOnly?: boolean;
  /** Forwarded to AnswerButtons — pass to add e.g. 'not-applicable'. */
  options?: TA6AnswerValue[];
  detailsPlaceholder?: string;
}

/**
 * A standard TA6 question: prompt header + segmented answer buttons + a
 * details textarea. The textarea appears when the answer is 'yes', and stays
 * visible (and editable) whenever details are non-empty so existing text is
 * never hidden by an answer change.
 */
export const ResponseField: React.FC<ResponseFieldProps> = ({
  refCode,
  prompt,
  value,
  onChange,
  readOnly = false,
  options,
  detailsPlaceholder,
}) => {
  const showDetails = value.answer === 'yes' || value.details !== '';

  return (
    <div className="space-y-3">
      <PromptHeader refCode={refCode} prompt={prompt} />
      <AnswerButtons
        value={value.answer}
        onChange={(answer) => onChange({ ...value, answer })}
        readOnly={readOnly}
        options={options}
        label={`${refCode} answer`}
      />
      {showDetails && (
        <textarea
          aria-label={`${refCode} details`}
          value={value.details}
          onChange={(e) => onChange({ ...value, details: e.target.value })}
          disabled={readOnly}
          rows={3}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 transition-colors focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 disabled:bg-gray-50 disabled:text-gray-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:disabled:bg-slate-800"
          placeholder={detailsPlaceholder ?? 'Please give details...'}
        />
      )}
    </div>
  );
};
