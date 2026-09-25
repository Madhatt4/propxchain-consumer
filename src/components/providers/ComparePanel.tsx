import type { Provider, PriceLabel } from './types';
import { formatProviderPrice } from './types';
import { StarRating } from './StarRating';
import { TierBadge } from './TierBadge';
import { SlaIndicator } from './SlaIndicator';

interface ComparePanelProps {
  providerA: Provider;
  providerB: Provider;
  priceLabel?: PriceLabel;
  onClear: () => void;
}

function CompareField({
  label,
  valueA,
  valueB,
  isDiff,
}: {
  label: string;
  valueA: React.ReactNode;
  valueB: React.ReactNode;
  isDiff?: boolean;
}): React.ReactElement {
  return (
    <div className="grid grid-cols-[1fr_1fr] gap-3 border-b border-gray-100 py-2 last:border-0 dark:border-[#1E2A3A]">
      <div>
        <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 md:hidden">
          {label}
        </span>
        <div className={isDiff ? 'text-teal-600 dark:text-teal-400' : ''}>{valueA}</div>
      </div>
      <div>
        <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 md:hidden">
          {label}
        </span>
        <div className={isDiff ? 'text-teal-600 dark:text-teal-400' : ''}>{valueB}</div>
      </div>
    </div>
  );
}

export function ComparePanel({
  providerA,
  providerB,
  priceLabel = 'inc VAT',
  onClear,
}: ComparePanelProps): React.ReactElement {
  const featuresA = new Set(providerA.features);
  const featuresB = new Set(providerB.features);

  return (
    <div className="relative rounded-xl border border-teal-500/20 bg-teal-500/5 p-4 dark:border-teal-400/20 dark:bg-teal-400/5">
      {/* Sticky dismiss for mobile */}
      <div className="sticky top-0 z-10 mb-3 flex items-center justify-between">
        <h4 className="font-dm-sans text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Comparing Providers
        </h4>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg px-2.5 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-[#141C2E] dark:hover:text-gray-200"
        >
          Clear
        </button>
      </div>

      {/* Column headers (desktop) */}
      <div className="hidden grid-cols-[1fr_1fr] gap-3 border-b border-gray-200 pb-2 dark:border-[#1E2A3A] md:grid">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 font-geist-mono text-xs font-semibold dark:bg-[#141C2E]">
            {providerA.logo}
          </div>
          <span className="font-dm-sans text-sm font-semibold text-gray-900 dark:text-gray-100">
            {providerA.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 font-geist-mono text-xs font-semibold dark:bg-[#141C2E]">
            {providerB.logo}
          </div>
          <span className="font-dm-sans text-sm font-semibold text-gray-900 dark:text-gray-100">
            {providerB.name}
          </span>
        </div>
      </div>

      {/* Comparison rows */}
      <div className="mt-2 space-y-0 text-xs text-gray-700 dark:text-gray-300">
        <CompareField
          label="Price"
          valueA={
            <span className="font-geist-mono font-semibold">
              {formatProviderPrice(providerA)} <span className="text-gray-400">{priceLabel}</span>
            </span>
          }
          valueB={
            <span className="font-geist-mono font-semibold">
              {formatProviderPrice(providerB)} <span className="text-gray-400">{priceLabel}</span>
            </span>
          }
          isDiff={providerA.price !== providerB.price}
        />
        <CompareField
          label="Turnaround"
          valueA={<span className="font-geist-mono">{providerA.turnaround}</span>}
          valueB={<span className="font-geist-mono">{providerB.turnaround}</span>}
          isDiff={providerA.turnaround !== providerB.turnaround}
        />
        <CompareField
          label="Rating"
          valueA={<StarRating rating={providerA.rating} reviews={providerA.reviews} />}
          valueB={<StarRating rating={providerB.rating} reviews={providerB.reviews} />}
        />
        <CompareField
          label="Tier"
          valueA={<TierBadge tier={providerA.tier} />}
          valueB={<TierBadge tier={providerB.tier} />}
          isDiff={providerA.tier !== providerB.tier}
        />
        <CompareField
          label="Regulation"
          valueA={<span>{providerA.regulated}</span>}
          valueB={<span>{providerB.regulated}</span>}
        />
        <CompareField
          label="SLA"
          valueA={<SlaIndicator slaLoad={providerA.slaLoad} />}
          valueB={<SlaIndicator slaLoad={providerB.slaLoad} />}
        />

        {/* Features with diff highlighting */}
        <div className="pt-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Features
          </span>
          <div className="mt-1.5 grid grid-cols-[1fr_1fr] gap-3">
            <ul className="space-y-1">
              {providerA.features.map((f) => (
                <li
                  key={f}
                  className={`flex items-start gap-1 ${!featuresB.has(f) ? 'text-teal-600 dark:text-teal-400' : ''}`}
                >
                  <span className="mt-0.5 text-[10px]">{!featuresB.has(f) ? '★' : '•'}</span>
                  {f}
                </li>
              ))}
            </ul>
            <ul className="space-y-1">
              {providerB.features.map((f) => (
                <li
                  key={f}
                  className={`flex items-start gap-1 ${!featuresA.has(f) ? 'text-teal-600 dark:text-teal-400' : ''}`}
                >
                  <span className="mt-0.5 text-[10px]">{!featuresA.has(f) ? '★' : '•'}</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
