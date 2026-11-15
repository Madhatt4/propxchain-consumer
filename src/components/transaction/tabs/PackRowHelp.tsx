// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/** The "?" button and the inline help panel it opens for one Sales pack row. */
import type { ReactNode } from 'react';
import { HELP_FIELDS, type PackRowHelp as PackRowHelpText } from './salesPackHelp';

export function PackHelpButton({
  title,
  isOpen,
  panelId,
  onToggle,
}: {
  title: string;
  isOpen: boolean;
  panelId: string;
  onToggle: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      aria-label={`What is ${title}?`}
      aria-expanded={isOpen}
      aria-controls={panelId}
      onClick={onToggle}
      className="ml-1.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-gray-400 bg-white align-[1px] text-[11px] text-gray-500 hover:border-teal-600 hover:text-teal-700 dark:border-slate-500 dark:bg-transparent dark:text-slate-400"
    >
      ?
    </button>
  );
}

export function PackHelpPanel({ id, help }: { id: string; help: PackRowHelpText }): ReactNode {
  return (
    <dl
      id={id}
      className="mt-2 rounded border-l-[3px] border-teal-600 bg-teal-50/60 px-2.5 py-2 text-[13px] text-gray-700 dark:bg-teal-500/10 dark:text-gray-300"
    >
      {HELP_FIELDS.map(({ key, label }) => (
        <div key={key} className="mt-1 first:mt-0">
          <dt className="text-xs font-semibold text-teal-800 dark:text-teal-300">{label}</dt>
          <dd className="m-0">{help[key]}</dd>
        </div>
      ))}
    </dl>
  );
}
