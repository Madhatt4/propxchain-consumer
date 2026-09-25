// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * "Groundsure won't supply these for this property" — shown between pricing and
 * payment, never after it.
 *
 * The worker prices a basket per property, and Groundsure can decline a line
 * for a site: a regional search off its patch, or a site outline outside every
 * price band. Those lines are excluded from the total before Stripe sees it, so
 * nobody is overcharged — but the customer TICKED them, and being quietly
 * supplied less than you chose is worse than being told. So the order stops
 * here and waits for a second, informed click.
 */

import React from 'react';

interface DroppedSearchesNoticeProps {
  /** Human names of the searches Groundsure declined, as the customer picked them. */
  names: string[];
  /** What the reduced basket now costs, in pence, VAT included. */
  totalPence: number;
  /** How many searches remain. */
  remainingCount: number;
  onContinue: () => void;
  onCancel: () => void;
  isBusy: boolean;
}

function pence(amount: number): string {
  return `£${(amount / 100).toFixed(2)}`;
}

export default function DroppedSearchesNotice({
  names,
  totalPence,
  remainingCount,
  onContinue,
  onCancel,
  isBusy,
}: DroppedSearchesNoticeProps): React.ReactElement {
  const single = names.length === 1;

  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-900/10 dark:text-amber-300"
    >
      <p className="font-medium">
        Groundsure can’t supply {single ? 'this search' : 'these searches'} for this property
      </p>

      <ul className="mt-2 list-disc space-y-1 pl-5">
        {names.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>

      {/* Named because "some searches were removed" sends people back to the
          list to work out which — and because a regional search declined for a
          property outside its area is not a fault to apologise for. */}
      <p className="mt-2">
        {single ? 'It is' : 'They are'} usually only available in specific areas. Nothing has been
        charged.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onContinue}
          disabled={isBusy}
          className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60"
        >
          {isBusy
            ? 'Opening payment…'
            : `Continue with ${remainingCount} ${remainingCount === 1 ? 'search' : 'searches'} — ${pence(totalPence)}`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isBusy}
          className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-700/40 dark:text-amber-300 dark:hover:bg-amber-900/20"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
