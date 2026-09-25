import type { ProviderPanelProps } from './types';
import { formatProviderPrice } from './types';
import { ProviderCard } from './ProviderCard';
import { ProviderRow } from './ProviderRow';
import { ComparePanel } from './ComparePanel';

function LoadingSkeleton(): React.ReactElement {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-gray-200 bg-white p-5 dark:border-[#1E2A3A] dark:bg-[#0E1425]"
        >
          <div className="flex gap-3">
            <div className="h-10 w-10 rounded-lg bg-gray-200 dark:bg-[#141C2E]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 rounded bg-gray-200 dark:bg-[#141C2E]" />
              <div className="h-3 w-40 rounded bg-gray-100 dark:bg-[#141C2E]" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full rounded bg-gray-100 dark:bg-[#141C2E]" />
            <div className="h-3 w-3/4 rounded bg-gray-100 dark:bg-[#141C2E]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProviderPanel({
  title,
  subtitle,
  // stageNumber kept in props for call-site compat; the parent StageCard
  // already shows the stage number, so the panel no longer renders it.
  badge,
  description,
  providers,
  isLoading,
  error,
  onRetry,
  onSelect,
  selectedId,
  onContinue,
  callout,
  extraContent,
  skippable,
  onSkip,
  priceLabel = 'inc VAT',
  compareIds = [],
  onCompareToggle,
  onCompareClear,
  layout = 'grid',
}: ProviderPanelProps): React.ReactElement {
  const selectedProvider = providers.find((p) => p.id === selectedId);
  const compareProviders = compareIds.length === 2
    ? [providers.find((p) => p.id === compareIds[0]), providers.find((p) => p.id === compareIds[1])]
    : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Header — the parent StageCard already shows "Stage N · <stage title>",
          so the big stage-number circle here is a duplicate. We keep the
          panel's own title (it adds info: e.g. StageCard reads "Conveyancer
          Review", panel reads "Conveyancer / Solicitor") at lighter weight
          alongside the badge.
          stageNumber kept in props for backwards compat; intentionally unused. */}
      <div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="font-fraunces text-lg font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h2>
          {badge && (
            <span className="rounded-full bg-teal-500/10 px-2.5 py-0.5 font-dm-sans text-xs font-medium text-teal-600 dark:bg-teal-400/10 dark:text-teal-400">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-1 font-dm-sans text-sm text-gray-500 dark:text-gray-400">
          {subtitle}
        </p>
        <p className="mt-2 font-dm-sans text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          {description}
        </p>
      </div>

      {/* Price guarantee */}
      <p className="flex items-center gap-1.5 font-dm-sans text-xs text-gray-500 dark:text-gray-400">
        <svg className="h-3.5 w-3.5 text-teal-500 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        Same price as going direct{' '}
        <span className="font-geist-mono text-[10px] text-gray-400">
          — no platform markup on provider fees
        </span>
      </p>

      {/* Optional callout banner */}
      {callout}

      {/* Compare panel */}
      {compareProviders?.[0] && compareProviders?.[1] && onCompareClear && (
        <ComparePanel
          providerA={compareProviders[0]}
          providerB={compareProviders[1]}
          priceLabel={priceLabel}
          onClear={onCompareClear}
        />
      )}

      {/* Optional extra content */}
      {extraContent}

      {/* Loading state */}
      {isLoading && <LoadingSkeleton />}

      {/* Error state */}
      {error && !isLoading && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-sm text-amber-700 dark:text-amber-300">{error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 text-sm font-medium text-amber-600 underline underline-offset-2 hover:text-amber-700 dark:text-amber-400"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Provider grid */}
      {!isLoading && !error && (
        <>
          {providers.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
              No providers available
            </p>
          ) : (
            layout === 'rows' ? (
              <div className="flex flex-col gap-2">
                {providers.map((provider) => (
                  <ProviderRow
                    key={provider.id}
                    provider={provider}
                    selected={provider.id === selectedId}
                    onSelect={onSelect}
                    priceLabel={priceLabel}
                    isCompared={compareIds.includes(provider.id)}
                    onCompareToggle={onCompareToggle}
                    compareDisabled={compareIds.length >= 2}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {providers.map((provider) => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    selected={provider.id === selectedId}
                    onSelect={onSelect}
                    priceLabel={priceLabel}
                    isCompared={compareIds.includes(provider.id)}
                    onCompareToggle={onCompareToggle}
                    compareDisabled={compareIds.length >= 2}
                  />
                ))}
              </div>
            )
          )}
        </>
      )}

      {/* Skip option */}
      {skippable && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onSkip}
            className="font-dm-sans text-sm text-gray-400 underline underline-offset-2 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            Skip this step
          </button>
        </div>
      )}

      {/* Confirmation bar */}
      {selectedProvider && (
        <div className="sticky bottom-0 flex items-center justify-between rounded-xl border border-[#0D9488]/30 bg-white/95 px-5 py-3.5 shadow-lg backdrop-blur dark:border-[#14B8A6]/30 dark:bg-[#0E1425]/95">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 font-geist-mono text-xs font-semibold text-gray-600 dark:bg-[#141C2E] dark:text-gray-300">
              {selectedProvider.logo}
            </div>
            <div>
              <p className="font-dm-sans text-sm font-medium text-gray-900 dark:text-gray-100">
                {selectedProvider.name}
              </p>
              <p className="font-geist-mono text-xs text-gray-500 dark:text-gray-400">
                {formatProviderPrice(selectedProvider, priceLabel)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onContinue(selectedProvider.id)}
            className="rounded-lg bg-[#0D9488] px-5 py-2 font-dm-sans text-sm font-medium text-white transition-colors hover:bg-[#0F766E] dark:bg-[#14B8A6] dark:hover:bg-[#2DD4BF]"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
