// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import React from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle, Loader2 } from 'lucide-react';

import type { ScanSummary, ScanTone } from '../../../../services/docClassify.service';

/** Where the automatic check of a just-uploaded file has got to. */
export type ScanState =
  | { phase: 'idle' }
  | { phase: 'scanning' }
  | { phase: 'done'; summary: ScanSummary }
  | { phase: 'failed' };

const TONE_STYLES: Record<ScanTone, { box: string; icon: string; Icon: typeof CheckCircle2 }> = {
  ok: {
    box: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100',
    icon: 'text-emerald-600 dark:text-emerald-400',
    Icon: CheckCircle2,
  },
  caution: {
    box: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100',
    icon: 'text-amber-600 dark:text-amber-400',
    Icon: AlertTriangle,
  },
  unknown: {
    box: 'border-gray-200 bg-gray-50 text-gray-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200',
    icon: 'text-gray-500 dark:text-slate-400',
    Icon: HelpCircle,
  },
};

const FAILED: ScanSummary = {
  tone: 'unknown',
  headline: "We couldn't check this document automatically.",
  details: ["It's still attached, and your conveyancer will review it."],
};

/** The scan's progress and then its verdict, full width under the attachment controls. */
export const ScanVerdict: React.FC<{ refCode: string; state: ScanState }> = ({ refCode, state }) => {
  if (state.phase === 'idle') return null;

  if (state.phase === 'scanning') {
    return (
      <div
        role="status"
        className="flex basis-full items-center gap-2.5 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800 dark:border-teal-800 dark:bg-teal-900/30 dark:text-teal-200"
      >
        <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
        Checking your document. This can take a moment.
      </div>
    );
  }

  const summary = state.phase === 'done' ? state.summary : FAILED;
  const { box, icon, Icon } = TONE_STYLES[summary.tone];
  return (
    <div
      role="status"
      aria-label={`${refCode} document check`}
      className={`flex basis-full items-start gap-3 rounded-lg border px-4 py-3 text-sm ${box}`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${icon}`} aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-semibold">{summary.headline}</p>
        <ul className="space-y-0.5">
          {summary.details.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};
