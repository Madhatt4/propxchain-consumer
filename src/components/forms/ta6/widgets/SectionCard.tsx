import React from 'react';
import { Check, CheckCircle2, CircleDashed, Loader2 } from 'lucide-react';

export interface SectionCardProps {
  /** 1-based TA6 section number (1..15). */
  index: number;
  title: string;
  /** Every answerable question in the section has a non-draft answer. */
  complete: boolean;
  /** The section has local edits not yet saved on-chain. */
  dirty: boolean;
  saving: boolean;
  /** Per-section save (plan requirement: sections save independently, not the whole form). */
  onSave: () => void;
  readOnly?: boolean;
  children: React.ReactNode;
}

const SaveState: React.FC<{ dirty: boolean; saving: boolean }> = ({ dirty, saving }) => {
  if (saving) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 dark:text-teal-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Saving...
      </span>
    );
  }
  if (dirty) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400">
        <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
        Unsaved changes
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
      <Check className="h-4 w-4" aria-hidden="true" />
      Saved
    </span>
  );
};

/**
 * Wrapper for one TA6 section: a friendly eyebrow + large title, completion
 * state, and a per-section Save. Generous rhythm between questions — the form
 * should read like a guided conversation, not a legal document (the exported
 * PDF keeps the formal layout for the record).
 */
export const SectionCard: React.FC<SectionCardProps> = ({
  index,
  title,
  complete,
  dirty,
  saving,
  onSave,
  readOnly = false,
  children,
}) => (
  <section
    className="rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    aria-label={`Section ${index}: ${title}`}
  >
    <div className="flex flex-wrap items-end justify-between gap-3 px-6 pt-6 sm:px-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400">
          Section {index} of 15
        </p>
        <h3 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">
          {title}
          {complete ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" />
          ) : (
            <CircleDashed className="h-5 w-5 text-gray-300 dark:text-slate-600" aria-hidden="true" />
          )}
        </h3>
      </div>
      <div className="flex items-center gap-3 pb-1">
        <SaveState dirty={dirty} saving={saving} />
        {!readOnly && (
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !dirty}
            className="rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-slate-900"
          >
            {saving ? 'Saving...' : 'Save section'}
          </button>
        )}
      </div>
    </div>
    <div className="space-y-8 p-6 sm:p-8">{children}</div>
  </section>
);
