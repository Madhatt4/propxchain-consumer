// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The searches in the chosen basket, itemised and non-interactive. Split out of
 * SearchPackageBuilder to keep that file under the 300-line rule when pack
 * selection landed.
 */

import { priceLabel, unpricedLabel } from './tmGroupCardHelpers';

import type { SearchItem } from '../../services/searchProviderData';

interface TmGroupIncludedListProps {
  heading: string;
  items: SearchItem[];
  linePence: Map<string, number>;
  unpriceable: Set<string>;
  suggestRefresh: boolean;
}

export default function TmGroupIncludedList({
  heading,
  items,
  linePence,
  unpriceable,
  suggestRefresh,
}: TmGroupIncludedListProps): JSX.Element {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {heading}
      </p>
      <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
        {items.map((search) => (
          <div key={search.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              {/* Always-checked, non-interactive */}
              <span
                aria-label="Included"
                className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 border-teal-500 bg-teal-500"
              >
                <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 10 8" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M1 4l3 3 5-5" />
                </svg>
              </span>
              <span className="text-sm text-gray-800 dark:text-gray-200">{search.name}</span>
            </div>
            {unpriceable.has(search.productType ?? '') ? (
              <span className="text-right text-xs text-amber-700 dark:text-amber-400">
                {unpricedLabel(suggestRefresh)}
              </span>
            ) : (
              <span className="font-mono tabular-nums text-sm text-gray-600 dark:text-gray-400">
                {priceLabel(linePence.get(search.productType ?? '') ?? 0)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
