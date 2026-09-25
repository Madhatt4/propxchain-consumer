// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * "Bring your own conveyancer" — search the full CLC register by firm name,
 * city, or postcode. Surfaces firms outside the curated top 5 for users with
 * an existing relationship or recommendation.
 */

import { useState } from 'react';
import { ProviderRow } from './ProviderRow';
import { useConveyancerSearch } from '../../hooks/useConveyancerSearch';
import { decorateProviders } from '../../services/lenderPanel.service';

interface ConveyancerSearchProps {
  selectedIds: string[];
  onToggleSelect: (providerId: string) => void;
  maxSelections: number;
  curatedIds: string[];
  /** Lender panel ids when the buyer's lender is known — badges results.
   *  null/undefined = no lender context (seller, builder, cash). */
  panelIds?: string[] | null;
  lenderName?: string;
}

export function ConveyancerSearch({
  selectedIds,
  onToggleSelect,
  maxSelections,
  curatedIds,
  panelIds,
  lenderName,
}: ConveyancerSearchProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { results, isLoading, error, hasQuery } = useConveyancerSearch(query);

  const outsideCurated = results.filter((p) => !curatedIds.includes(p.id));
  const filtered =
    panelIds && lenderName ? decorateProviders(outsideCurated, panelIds, lenderName) : outsideCurated;
  const atMaxSelection = selectedIds.length >= maxSelections;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-[#1E2A3A] dark:bg-[#0E1425]">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between"
        aria-expanded={isOpen}
      >
        <div className="text-left">
          <h4 className="font-dm-sans text-sm font-semibold text-gray-900 dark:text-gray-100">
            Don't see your conveyancer?
          </h4>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Search the full CLC register by firm name, city, or postcode.
          </p>
        </div>
        <svg
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="mt-3 space-y-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Richardsons, Bedford, MK40"
            aria-label="Search conveyancer panel"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-dm-sans text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488] dark:border-[#1E2A3A] dark:bg-[#141C2E] dark:text-gray-100 dark:placeholder:text-gray-500"
          />

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          {!hasQuery && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Type at least 2 characters to search 200+ CLC-regulated firms.
            </p>
          )}

          {hasQuery && !isLoading && filtered.length === 0 && !error && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No matches. All firms shown above are also in the panel.
            </p>
          )}

          {isLoading && (
            <p className="text-xs text-gray-500 dark:text-gray-400">Searching…</p>
          )}

          {filtered.length > 0 && (
            <div className="space-y-2">
              {filtered.map((provider) => {
                const isSelected = selectedIds.includes(provider.id);
                return (
                  <ProviderRow
                    key={provider.id}
                    provider={provider}
                    selected={isSelected}
                    onSelect={
                      atMaxSelection && !isSelected ? () => undefined : onToggleSelect
                    }
                    priceLabel="+ disbursements"
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
