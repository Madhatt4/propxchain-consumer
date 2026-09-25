import { useMemo, useState } from 'react';
import { onesearchPacks, vatPenceOn, type SearchItem } from '../../services/searchProviderData';

interface OneSearchPackageBuilderProps {
  postcode: string;
  localAuthority: string;
  /** Area capabilities flagged from the postcode/LA (e.g. coal). Used for a nudge. */
  areaRequiredIds?: string[];
  onOrder: (searches: SearchItem[], totalPence: number) => void;
  isOrdering: boolean;
  /** Why the last order attempt failed. Shown above the button so it isn't missed. */
  errorMessage?: string | null;
}

function pounds(amount: number): string {
  return `£${(amount / 100).toFixed(2)}`;
}

export default function OneSearchPackageBuilder({
  postcode,
  localAuthority,
  areaRequiredIds = [],
  onOrder,
  isOrdering,
  errorMessage = null,
}: OneSearchPackageBuilderProps): React.ReactElement {
  // Named, not positional: onesearchPacks is ordered cheapest-first as a price
  // ladder, so [0] is whatever is currently cheapest rather than what we want
  // preselected. Standard is the recommended tier and covers ~90% of cases.
  const defaultPack =
    onesearchPacks.find((p) => p.id === 'standard') ?? onesearchPacks[0];
  const [selectedId, setSelectedId] = useState<string>(defaultPack?.id ?? '');

  const selected = useMemo(
    () => onesearchPacks.find((p) => p.id === selectedId) ?? defaultPack,
    [selectedId, defaultPack],
  );

  // `rrpPence` is VAT-INCLUSIVE from 2026-08-21 and IS the charged total —
  // onesearch-worker stamps the same figure as retail_gbp and payment-worker takes
  // it verbatim. Never add VAT to it again; the split below comes off `netPence`.
  const vatPence = vatPenceOn(selected.netPence);
  const totalPence = selected.rrpPence;
  const areaNeedsCoal = areaRequiredIds.some((id) => id.toLowerCase().includes('coal'));

  function handleOrder(): void {
    onOrder(selected.items, totalPence);
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Choose a bundle — tap one to see what&rsquo;s included.
      </p>

      {/* Pack picker — tap a pack to select it and open its itemised card */}
      <div className="space-y-2.5">
        {onesearchPacks.map((p) => {
          const isSelected = p.id === selected.id;
          return (
            <div
              key={p.id}
              className={[
                'rounded-lg border transition-colors',
                isSelected
                  ? 'border-teal-500 bg-teal-50/40 dark:border-teal-400 dark:bg-teal-500/5'
                  : 'border-gray-200 dark:border-gray-700',
              ].join(' ')}
            >
              <button
                type="button"
                onClick={() => setSelectedId(p.id)}
                aria-expanded={isSelected}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <span
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`Select ${p.name}`}
                    className={[
                      'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                      isSelected ? 'border-teal-500' : 'border-gray-300 dark:border-gray-600',
                    ].join(' ')}
                  >
                    {isSelected && <span className="h-2 w-2 rounded-full bg-teal-500" />}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {p.name}
                      </span>
                      {p.badge && (
                        <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
                          {p.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{p.tagline}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono tabular-nums text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {pounds(p.rrpPence)}
                  </div>
                  <div className="text-[10px] text-gray-400 dark:text-gray-500">inc VAT</div>
                </div>
              </button>

              {/* Itemised card — what's in the pack, revealed on selection */}
              {isSelected && (
                <div className="border-t border-teal-200/60 px-4 py-3 dark:border-teal-500/20">
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    What&rsquo;s included
                  </p>
                  <ul className="space-y-1.5">
                    {p.items.map((item) => (
                      <li key={item.id} className="flex items-start gap-2">
                        <svg
                          className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-teal-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                          aria-hidden
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-800 dark:text-gray-200">{item.name}</span>
                          {item.turnaround && (
                            <span className="font-geist-mono text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
                              {item.turnaround}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {p.note && (
                    <p className="mt-2.5 text-xs text-gray-500 dark:text-gray-400">{p.note}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Coal-area nudge — Premium's RVR already includes coal */}
      {areaNeedsCoal && selected.id !== 'premium' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/10 dark:text-amber-400">
          ⚠ This area may need a coal mining search. Premium (Full Risk View) includes it, or
          add one separately via Groundsure.
        </div>
      )}

      {/* Price summary — every figure VAT-inclusive, VAT disclosed inside the
          total rather than as a line that appears to add to it. `rrpPence` is
          already gross and IS the charged total, so the pack line simply
          repeats it. */}
      <div className="rounded-lg bg-gray-50 px-4 py-4 dark:bg-gray-800/50">
        <div className="space-y-1.5">
          {/* No per-line row: a pack is one item and `totalPence` IS its
              `rrpPence`, so listing it above the Total printed the same number
              twice. The pack's name and price are already on the selected card. */}
          <div className="border-t border-gray-200 pt-2 dark:border-gray-700">
            <div className="flex justify-between">
              <span className="font-medium text-gray-900 dark:text-gray-100">Total</span>
              <span className="font-mono tabular-nums text-lg font-semibold text-teal-600 dark:text-teal-400">
                {pounds(totalPence)}
              </span>
            </div>
            <p className="mt-0.5 text-right text-[10px] text-gray-400 dark:text-gray-500">
              includes {pounds(vatPence)} VAT
            </p>
          </div>
        </div>
        {postcode && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Searches for {postcode}
            {localAuthority ? ` · ${localAuthority}` : ''}
          </p>
        )}
      </div>

      {selected.orderCodesPending && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/10 dark:text-amber-400">
          This tier isn&rsquo;t orderable yet — OneSearch are confirming its final product
          codes. The Standard bundle is available now.
        </div>
      )}

      {errorMessage && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/10 dark:text-red-400"
        >
          {errorMessage}
        </p>
      )}

      <button
        type="button"
        onClick={handleOrder}
        disabled={isOrdering || selected.orderCodesPending}
        className="w-full rounded-lg bg-teal-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-600 dark:hover:bg-teal-500"
      >
        {isOrdering
          ? 'Placing order…'
          : selected.orderCodesPending
            ? `${selected.name} — coming soon`
            : `Order ${selected.name} via OneSearch →`}
      </button>
    </div>
  );
}
