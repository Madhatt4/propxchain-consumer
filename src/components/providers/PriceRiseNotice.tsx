// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import React from 'react';

interface PriceRiseNoticeProps {
  shownPence: number;
  totalPence: number;
  searchCount: number;
  onContinue: () => void;
  onCancel: () => void;
  isBusy: boolean;
}

function pence(amount: number): string {
  return `£${(amount / 100).toFixed(2)}`;
}

export default function PriceRiseNotice({
  shownPence,
  totalPence,
  searchCount,
  onContinue,
  onCancel,
  isBusy,
}: PriceRiseNoticeProps): React.ReactElement {
  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-900/10 dark:text-amber-300"
    >
      <p className="font-medium">The price for this property is {pence(totalPence)}</p>
      <p className="mt-2">
        That is more than the {pence(shownPence)} shown, because some searches are priced by the
        size of the site. Nothing has been charged.
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
            : `Continue with ${searchCount} ${searchCount === 1 ? 'search' : 'searches'} — ${pence(totalPence)}`}
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
