import { useEffect, useMemo, useRef } from 'react';
import {
  groundsureRegionals,
  groundsureSingles,
  grossPence,
  type SearchItem,
} from '../../services/searchProviderData';

interface GroundsureProductListCardProps {
  /** Area capability tags derived from the postcode/LA (e.g. 'coal-mining'). Drives pre-ticked reasons. */
  areaCapabilities?: string[];
  /** Panel item ids the buyer/seller's conveyancer has explicitly asked for. */
  conveyancerRequestedIds?: string[];
  /** Currently ticked item ids — owned by GroundsureBundlePicker so bundle + extras share one basket. */
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  /** Tick ids the area rules recommend, once the postcode lookup resolves. */
  onApplyRecommended: (ids: string[]) => void;
}

// Maps an area capability tag (SearchesPanel.tsx's getCapabilitiesForArea) to
// the Groundsure item ids it should pre-tick, plus the reason shown next to
// the tick. Unlike OneSearch there is no supplier recommendations API to lean
// on, so these are our own rules over the region-scoped `groundsureRegionals`
// group — see docs/handoffs/2026-07-27-groundsure-full-product-list.md.
const AREA_CAPABILITY_REASONS: Record<string, { ids: string[]; reason: string }> = {
  'coal-mining': {
    ids: ['groundsure-con29m-coal', 'groundsure-georisk-cert-coal-brine'],
    reason: 'Recommended for this area — known coal mining risk',
  },
  brine: {
    ids: ['groundsure-cheshire-salt'],
    reason: 'Recommended for this area — brine subsidence risk',
  },
  'tin-mining': {
    ids: ['groundsure-metalliferous-mining'],
    reason: 'Recommended for this area — metalliferous mining risk',
  },
  'stone-mining': {
    ids: ['groundsure-stone-mining'],
    reason: 'Recommended for this area — stone mining risk',
  },
};

function reasonForItem(
  itemId: string,
  areaCapabilities: string[],
  conveyancerRequestedIds: string[],
): string | null {
  if (conveyancerRequestedIds.includes(itemId)) {
    return 'Your conveyancer asked for this';
  }
  for (const capability of areaCapabilities) {
    const rule = AREA_CAPABILITY_REASONS[capability];
    if (rule?.ids.includes(itemId)) return rule.reason;
  }
  return null;
}

function pounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

/**
 * Every Groundsure product outside the bundles, as a tick-box list with the
 * reason each pre-tick was made. Deliberately mirrors
 * OneSearchProductListCard's interaction so a user learns it once — the one
 * difference is that everything here has a confirmed RRP, so ticks feed the
 * bundle picker's running total and are paid for in the same checkout rather
 * than raised as a costing request.
 *
 * Selection state lives in the parent so a bundle and its extras stay one
 * basket and one Stripe charge.
 */
export default function GroundsureProductListCard({
  areaCapabilities = [],
  conveyancerRequestedIds = [],
  selectedIds,
  onToggle,
  onApplyRecommended,
}: GroundsureProductListCardProps): React.ReactElement {
  // Regionals first: an area-flagged search is the reason most people open
  // this list at all, so it shouldn't sit below seven single-topic reports.
  const catalogue = useMemo(() => [...groundsureRegionals, ...groundsureSingles], []);

  const recommendedIds = useMemo(() => {
    return catalogue
      .filter((item) => reasonForItem(item.id, areaCapabilities, conveyancerRequestedIds))
      .map((item) => item.id);
  }, [catalogue, areaCapabilities, conveyancerRequestedIds]);

  // areaCapabilities resolves asynchronously (the postcode lookup finishes
  // after first paint), so recommendations arrive on a later render. Apply
  // each id once, tracked in a ref, so a user who deliberately unticks a
  // recommendation doesn't have it silently re-ticked on the next unrelated
  // re-render. Same guard as OneSearchProductListCard.
  const appliedReasonIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const toAdd = recommendedIds.filter((id) => !appliedReasonIdsRef.current.has(id));
    if (toAdd.length === 0) return;
    toAdd.forEach((id) => appliedReasonIdsRef.current.add(id));
    onApplyRecommended(toAdd);
  }, [recommendedIds, onApplyRecommended]);

  const selectedCount = catalogue.filter((item) => selectedIds.has(item.id)).length;
  const hasRecommendation = recommendedIds.length > 0;

  return (
    <details
      className="rounded-lg border border-gray-200 dark:border-gray-700"
      // Open by default when this property's area needs something, so a
      // required search is never hidden behind a closed disclosure.
      open={hasRecommendation}
    >
      <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3">
        <div>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Need something extra?
          </span>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Browse every Groundsure search — for properties the bundles don&rsquo;t fully cover.
          </p>
        </div>
        {selectedCount > 0 && (
          <span className="shrink-0 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-medium text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
            {selectedCount} added
          </span>
        )}
      </summary>

      <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-700/50">
        {hasRecommendation && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/10 dark:text-amber-400">
            We&rsquo;ve ticked what this property&rsquo;s area suggests. Untick anything you
            don&rsquo;t want — your conveyancer may still ask for it.
          </div>
        )}

        <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto">
          {catalogue.map((item: SearchItem) => {
            const reason = reasonForItem(item.id, areaCapabilities, conveyancerRequestedIds);
            return (
              <li key={item.id}>
                <label className="flex items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => onToggle(item.id)}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500 dark:border-gray-600"
                  />
                  <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
                    <div>
                      <span className="text-sm text-gray-800 dark:text-gray-200">{item.name}</span>
                      {reason && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                          {reason}
                        </span>
                      )}
                      {item.turnaround && (
                        <span className="block font-geist-mono text-[10px] text-gray-400 dark:text-gray-500">
                          {item.turnaround}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-gray-500 dark:text-gray-400">
                      {pounds(grossPence(item.pricePence))}
                    </span>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
