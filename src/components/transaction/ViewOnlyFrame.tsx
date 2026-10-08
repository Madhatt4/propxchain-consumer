// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Wraps a stage or section the viewer may see but not change (level `view`
 * in lib/dealAccess). A disabled fieldset switches off every button, input
 * and upload inside it in one place, so a panel doesn't need its own
 * read-only mode to be safe. Links still work, so the viewer can open and
 * read what's there.
 */
import type { ReactNode } from 'react';
import { Eye } from 'lucide-react';
import type { DealSide } from '@/lib/dealAccess';

/** Who can act, in words, for the viewer who can't. */
export function viewOnlyNote(side: DealSide): string {
  return side === 'buyer'
    ? 'View only. This is for the seller to complete.'
    : 'View only. The buyer and seller complete this.';
}

export function ViewOnlyFrame({ side, children }: { side: DealSide; children: ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <p
        role="note"
        className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300"
      >
        <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
        {viewOnlyNote(side)}
      </p>
      <fieldset disabled className="m-0 min-w-0 border-0 p-0" aria-label="View only">
        {children}
      </fieldset>
    </div>
  );
}
