// Shared style constants + the Allowed/Not-allowed pill row for the TA7 form.

import React from 'react';
import { Check, X } from 'lucide-react';

export const CARD =
  'rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900';
export const LABEL = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300';
export const INPUT =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-base text-gray-900 ' +
  'placeholder:text-gray-400 transition-colors focus:border-teal-500 focus:outline-none ' +
  'focus:ring-2 focus:ring-teal-500/30 disabled:bg-gray-50 disabled:text-gray-500 ' +
  'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500';
export const SECTION_TITLE =
  'text-lg font-bold tracking-tight text-gray-900 dark:text-slate-100';
export const PILL =
  'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ' +
  'duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ' +
  'focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed';

export interface PermissionRowProps {
  label: string;
  value: boolean;
  readOnly: boolean;
  onChange: (value: boolean) => void;
}

export const PermissionRow: React.FC<PermissionRowProps> = ({ label, value, readOnly, onChange }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-4 dark:bg-slate-800/60">
    <span className="text-base font-medium text-gray-900 dark:text-slate-100">{label}</span>
    <div role="group" aria-label={label} className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange(true)}
        disabled={readOnly}
        aria-pressed={value}
        className={`${PILL} ${
          value
            ? 'bg-teal-600 text-white shadow-sm hover:bg-teal-700'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
        }`}
      >
        {value && <Check className="h-4 w-4" aria-hidden="true" />}
        Allowed
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        disabled={readOnly}
        aria-pressed={!value}
        className={`${PILL} ${
          !value
            ? 'bg-rose-100 text-rose-700 shadow-sm hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-300'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
        }`}
      >
        {!value && <X className="h-4 w-4" aria-hidden="true" />}
        Not allowed
      </button>
    </div>
  </div>
);
