import React from 'react';

import type { TA6PromptEntry } from './types';

export interface PromptHeaderProps {
  /** TA6 question reference, e.g. '2.3'. */
  refCode: string;
  /** Paraphrased prompt from the wording bundle; undefined renders the ref chip only. */
  prompt: TA6PromptEntry | undefined;
}

/**
 * Question header: the paraphrased prompt leads at body size (the question is
 * the interface, so it gets the type weight); the ref badge stays quiet next
 * to it. Per-question official-wording links were dropped as noise — the form
 * shell carries ONE link to the official Law Society form (ADR 0009), so the
 * lawSocietyAnchor still flows in on the prompt but is not rendered here.
 */
export const PromptHeader: React.FC<PromptHeaderProps> = ({ refCode, prompt }) => (
  <div className="space-y-1.5">
    <div className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex shrink-0 items-center rounded-md bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
        {refCode}
      </span>
      {prompt && (
        <p className="text-base font-medium leading-snug text-gray-900 dark:text-slate-100">
          {prompt.prompt}
        </p>
      )}
    </div>
    {prompt?.helpText && (
      <p className="text-sm leading-relaxed text-gray-500 dark:text-slate-400">{prompt.helpText}</p>
    )}
  </div>
);
