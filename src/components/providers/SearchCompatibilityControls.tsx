// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Search-acceptance compatibility UI atoms for the conveyancer stage: filter
 * bar (filter active) and fallback banner (too few firms confirmed accepting
 * to filter usefully). No capture prompt — unlike the lender, the original
 * search-issue date comes from the transaction, not the user.
 */

interface SearchCompatibilityFilterBarProps {
  /** Total firms confirmed as 'accepts' (unbounded by the rendered slice). */
  matchCount: number;
  /** Rows actually rendered below the bar — may be fewer than matchCount. */
  shownCount: number;
  showAll: boolean;
  onToggleShowAll: () => void;
}

export function SearchCompatibilityFilterBar({
  matchCount,
  shownCount,
  showAll,
  onToggleShowAll,
}: SearchCompatibilityFilterBarProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 dark:border-teal-800 dark:bg-teal-900/20">
      <p className="text-xs text-teal-700 dark:text-teal-300">
        {showAll
          ? `Showing all nearby firms — ${matchCount} accept your existing searches`
          : `Showing the ${shownCount} firms that accept your existing searches (${matchCount} confirmed)`}
      </p>
      <button
        type="button"
        onClick={onToggleShowAll}
        className="text-xs font-medium text-teal-700 underline hover:text-teal-900 dark:text-teal-300 dark:hover:text-teal-100"
      >
        {showAll ? 'Show only firms that accept' : 'Show all firms'}
      </button>
    </div>
  );
}

export function SearchCompatibilityFallbackBanner(): React.ReactElement {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-[#1E2A3A] dark:bg-[#141C2E]">
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Most firms haven&apos;t told us whether they&apos;ll accept your existing
        searches — showing all firms so you can ask directly.
      </p>
    </div>
  );
}
