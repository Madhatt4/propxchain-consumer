import type { PriceLabel, Provider } from './types';
import { formatProviderPrice } from './types';
import { HighlightBadge } from './HighlightBadge';
import { StarRating } from './StarRating';
import { TierBadge } from './TierBadge';
import { SlaIndicator } from './SlaIndicator';

interface ProviderCardProps {
  provider: Provider;
  selected: boolean;
  onSelect: (id: string) => void;
  priceLabel?: PriceLabel;
  isCompared?: boolean;
  onCompareToggle?: (id: string) => void;
  compareDisabled?: boolean;
}

export function ProviderCard({
  provider,
  selected,
  onSelect,
  priceLabel = 'inc VAT',
  isCompared,
  onCompareToggle,
  compareDisabled,
}: ProviderCardProps): React.ReactElement {
  return (
    <div
      className={`relative flex w-full flex-col rounded-xl border p-5 text-left transition-colors duration-150 ${
        selected
          ? 'border-[#0D9488] shadow-[0_0_12px_rgba(13,148,136,0.15)] dark:border-[#14B8A6] dark:shadow-[0_0_12px_rgba(20,184,166,0.15)]'
          : 'border-gray-200 hover:border-gray-300 dark:border-[#1E2A3A] dark:hover:border-[#2a3a4f]'
      } bg-white dark:bg-[#0E1425]`}
    >
      {provider.highlight && <HighlightBadge type={provider.highlight} />}

      {/* Header: logo + name + location/distance */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 font-geist-mono text-sm font-semibold text-gray-600 dark:bg-[#141C2E] dark:text-gray-300">
          {provider.logo}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-dm-sans text-sm font-semibold text-gray-900 dark:text-gray-100">
              {provider.name}
            </h3>
            {provider.distanceMiles != null ? (
              <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                {provider.distanceMiles} mi
              </span>
            ) : provider.location ? (
              <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                {provider.location}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {provider.tagline}
          </p>
        </div>
      </div>

      {/* Badges row */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <TierBadge tier={provider.tier} />
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-[#141C2E] dark:text-gray-400">
          {provider.regulated}
        </span>
        <SlaIndicator slaLoad={provider.slaLoad} />
      </div>

      {/* Price + turnaround */}
      <div className="mt-3 flex items-baseline justify-between">
        <div className="flex items-baseline gap-1">
          <span className="font-geist-mono text-lg font-semibold text-gray-900 dark:text-gray-100">
            {formatProviderPrice(provider)}
          </span>
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            {priceLabel}
          </span>
        </div>
        <span className="font-geist-mono text-xs text-gray-500 dark:text-gray-400">
          {provider.turnaround}
        </span>
      </div>

      {/* Rating */}
      <div className="mt-2">
        <StarRating rating={provider.rating} reviews={provider.reviews} />
      </div>

      {/* Features */}
      <ul className="mt-3 space-y-1.5">
        {provider.features.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400"
          >
            <svg
              className="mt-0.5 h-3 w-3 shrink-0 text-teal-500 dark:text-teal-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {feature}
          </li>
        ))}
      </ul>

      {/* Bottom row: Select + Compare */}
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onSelect(provider.id)}
          className="flex-1"
        >
          {selected ? (
            <span className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0D9488] py-2 font-dm-sans text-sm font-medium text-white dark:bg-[#14B8A6]">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Selected
            </span>
          ) : (
            <span className="flex w-full items-center justify-center rounded-lg border border-gray-200 py-2 font-dm-sans text-sm font-medium text-gray-500 dark:border-[#1E2A3A] dark:text-gray-400">
              Select
            </span>
          )}
        </button>

        {onCompareToggle && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCompareToggle(provider.id);
            }}
            disabled={compareDisabled && !isCompared}
            className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
              isCompared
                ? 'border-teal-500 bg-teal-500/10 text-teal-600 dark:border-teal-400 dark:text-teal-400'
                : compareDisabled
                  ? 'cursor-not-allowed border-gray-200 text-gray-300 dark:border-[#1E2A3A] dark:text-gray-600'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-[#1E2A3A] dark:text-gray-400'
            }`}
          >
            {isCompared ? 'Comparing' : 'Compare'}
          </button>
        )}
      </div>
    </div>
  );
}
