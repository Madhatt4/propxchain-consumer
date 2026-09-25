// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Compact horizontal row variant of ProviderCard. Same data, laid out
 * left-to-right so multiple providers can be scanned quickly without
 * scrolling through tall cards. Used by ConveyancerPanel where users
 * typically compare ~10 providers by name, distance, CLC, and price.
 */

import type { PriceLabel, Provider } from './types';
import { StarRating } from './StarRating';

interface ProviderRowProps {
  provider: Provider;
  selected: boolean;
  onSelect: (id: string) => void;
  priceLabel?: PriceLabel;
  isCompared?: boolean;
  onCompareToggle?: (id: string) => void;
  compareDisabled?: boolean;
}

export function ProviderRow({
  provider,
  selected,
  onSelect,
  priceLabel = 'inc VAT',
  isCompared,
  onCompareToggle,
  compareDisabled,
}: ProviderRowProps): React.ReactElement {
  const ringClass = selected
    ? 'border-[#0D9488] shadow-[0_0_8px_rgba(13,148,136,0.15)] dark:border-[#14B8A6] dark:shadow-[0_0_8px_rgba(20,184,166,0.15)]'
    : 'border-gray-200 hover:border-gray-300 dark:border-[#1E2A3A] dark:hover:border-[#2a3a4f]';

  return (
    <div
      className={`flex w-full items-center gap-4 rounded-lg border bg-white px-4 py-3 transition-colors duration-150 dark:bg-[#0E1425] ${ringClass}`}
    >
      {/* Logo */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 font-geist-mono text-sm font-semibold text-gray-600 dark:bg-[#141C2E] dark:text-gray-300">
        {provider.logo}
      </div>

      {/* Name + sub */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-dm-sans text-sm font-semibold text-gray-900 dark:text-gray-100">
            {provider.name}
          </h3>
          {provider.highlight && (
            <span className="shrink-0 rounded-full bg-[#0D9488]/10 px-2 py-0.5 text-[10px] font-medium text-[#0D9488] dark:bg-[#14B8A6]/10 dark:text-[#14B8A6]">
              {provider.highlight}
            </span>
          )}
          {provider.lenderPanelStatus === 'on' && provider.lenderPanelName && (
            <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400">
              On {provider.lenderPanelName}&apos;s panel ✓
            </span>
          )}
          {provider.lenderPanelStatus === 'off' && provider.lenderPanelName && (
            <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:bg-amber-400/10 dark:text-amber-400">
              Not on {provider.lenderPanelName}&apos;s panel
            </span>
          )}
          {/* reorders is a legitimate procurement choice, not a defect — it
              gets the same neutral slate treatment as unknown, never the
              amber "warning" look used for lender-panel mismatches above.
              Text always comes from searchCompatibilityReason (stamped by
              decorateSearchCompatibility) rather than a literal duplicated
              here, so copy can never drift between the two. */}
          {provider.searchCompatibility === 'accepts' && provider.searchCompatibilityReason && (
            <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400">
              {provider.searchCompatibilityReason}
            </span>
          )}
          {provider.searchCompatibility === 'reorders' && provider.searchCompatibilityReason && (
            <span className="shrink-0 rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-400/10 dark:text-slate-400">
              {provider.searchCompatibilityReason}
            </span>
          )}
          {provider.searchCompatibility === 'unknown' && provider.searchCompatibilityReason && (
            <span className="shrink-0 rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-400/10 dark:text-slate-400">
              {provider.searchCompatibilityReason}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
          {provider.location && <span>{provider.location}</span>}
          {provider.distanceMiles != null && (
            <span>{provider.distanceMiles} mi</span>
          )}
          <span className="truncate">{provider.regulated}</span>
        </div>
      </div>

      {/* Rating + reviews — hidden on narrow screens */}
      <div className="hidden min-w-[90px] sm:block">
        <StarRating rating={provider.rating} reviews={provider.reviews} />
      </div>

      {/* Price + turnaround. Conveyancers quote per-job, so price === 0 is
          the "no quote yet" state — render that as plain text rather than
          a misleading "£0.00". */}
      <div className="hidden min-w-[110px] text-right md:block">
        {provider.price !== undefined && provider.price > 0 ? (
          <>
            <div className="font-geist-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
              £{provider.price.toFixed(2)}
            </div>
            <div className="text-[10px] text-gray-400 dark:text-gray-500">{priceLabel}</div>
          </>
        ) : (
          <div className="font-dm-sans text-xs text-gray-500 dark:text-gray-400">
            Quote on request
          </div>
        )}
        {provider.turnaround && (
          <div className="mt-0.5 font-geist-mono text-[10px] text-gray-500 dark:text-gray-400">
            {provider.turnaround}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => onCompareToggle?.(provider.id)}
          disabled={!onCompareToggle || (compareDisabled && !isCompared)}
          className={`rounded-md border px-3 py-1.5 font-dm-sans text-xs font-medium transition-colors ${
            isCompared
              ? 'border-[#0D9488] bg-[#0D9488]/5 text-[#0D9488] dark:border-[#14B8A6] dark:bg-[#14B8A6]/5 dark:text-[#14B8A6]'
              : 'border-gray-300 text-gray-600 hover:border-gray-400 dark:border-[#1E2A3A] dark:text-gray-300 dark:hover:border-[#2a3a4f]'
          } ${(!onCompareToggle || (compareDisabled && !isCompared)) ? 'cursor-not-allowed opacity-50' : ''}`}
          aria-pressed={isCompared}
        >
          {isCompared ? 'Comparing' : 'Compare'}
        </button>
        <button
          type="button"
          onClick={() => onSelect(provider.id)}
          className={`rounded-md px-4 py-1.5 font-dm-sans text-xs font-semibold transition-colors ${
            selected
              ? 'bg-[#0D9488] text-white hover:bg-[#0F766E] dark:bg-[#14B8A6] dark:hover:bg-[#0D9488]'
              : 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-gray-100'
          }`}
        >
          {selected ? 'Selected' : 'Select'}
        </button>
      </div>
    </div>
  );
}
