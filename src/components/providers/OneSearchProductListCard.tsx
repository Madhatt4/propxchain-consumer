import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getResidentialOneSearchCatalogue,
  grossPence,
  type OneSearchCatalogueItem,
} from '../../services/searchProviderData';
import type { SearchItem } from '../../services/searchProviderData';

interface OneSearchProductListCardProps {
  /** Area capability tags derived from the postcode/LA (e.g. 'coal-mining'). Drives pre-ticked reasons. */
  areaCapabilities?: string[];
  /** PISCES codes the buyer/seller's conveyancer has explicitly asked for. */
  conveyancerRequestedCodes?: string[];
  /**
   * Submit the ticked products as a costing request — logged for the
   * transaction, not paid for. Per OneSearch: when someone picks a product
   * outside a pack, tell them and they sort the trade cost from there. Items that already carry a confirmed retailPricePence show
   * that price and contribute to the total; items still awaiting a price
   * show "Price TBC" and total £0 — either way the request goes through the
   * same 24-hour-turnaround path until per-product trade pricing exists.
   *
   * Resolves false if the request did not reach OneSearch. There is no paid
   * order behind this, so an undelivered request is simply lost — the card
   * must offer a retry rather than claim success.
   */
  onRequest: (searches: SearchItem[], totalPence: number) => Promise<boolean>;
  isRequesting: boolean;
}

// Maps an area capability tag (SearchesPanel.tsx's getCapabilitiesForArea) to
// the full-catalogue PISCES codes it should pre-tick, plus the reason shown
// next to the tick. Only coal has a direct catalogue match today — brine and
// tin-mining are sold via Groundsure (see groundsureRegionals), not PISCES.
const AREA_CAPABILITY_REASONS: Record<string, { codes: string[]; reason: string }> = {
  'coal-mining': {
    codes: ['LANDMARKCOAL', 'TERRAFIRMACOALRESI'],
    reason: 'Recommended for this area — known coal mining risk',
  },
};

function reasonForItem(
  item: OneSearchCatalogueItem,
  areaCapabilities: string[],
  conveyancerRequestedCodes: string[],
): string | null {
  if (conveyancerRequestedCodes.includes(item.code)) {
    return 'Your conveyancer asked for this';
  }
  for (const capability of areaCapabilities) {
    const rule = AREA_CAPABILITY_REASONS[capability];
    if (rule?.codes.includes(item.code)) return rule.reason;
  }
  return null;
}

function pounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function toSearchItem(item: OneSearchCatalogueItem): SearchItem {
  return {
    id: item.id,
    name: item.name,
    pricePence: item.retailPricePence ?? 0,
    included: false,
    category: 'optional',
    productType: item.code,
  };
}

export default function OneSearchProductListCard({
  areaCapabilities = [],
  conveyancerRequestedCodes = [],
  onRequest,
  isRequesting,
}: OneSearchProductListCardProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestFailed, setRequestFailed] = useState(false);
  const catalogue = useMemo(() => getResidentialOneSearchCatalogue(), []);

  const preTicked = useMemo(() => {
    const ids = new Set<string>();
    for (const item of catalogue) {
      if (reasonForItem(item, areaCapabilities, conveyancerRequestedCodes)) ids.add(item.id);
    }
    return ids;
  }, [catalogue, areaCapabilities, conveyancerRequestedCodes]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(preTicked);

  // areaCapabilities resolves asynchronously (postcode lookup finishes after
  // first paint), so preTicked starts empty and fills in on a later render.
  // Apply newly-recommended ids once, tracked in a ref so a user who
  // deliberately unticks a recommendation doesn't have it silently re-ticked
  // on the next unrelated re-render.
  const appliedReasonIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const toAdd = [...preTicked].filter((id) => !appliedReasonIdsRef.current.has(id));
    if (toAdd.length === 0) return;
    toAdd.forEach((id) => appliedReasonIdsRef.current.add(id));
    setSelectedIds((prev) => new Set([...prev, ...toAdd]));
  }, [preTicked]);

  function toggle(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // `retailPricePence` is EX-VAT (searchProviderData: "RRP in pence, ex-VAT"),
  // unlike the pack figures `rrpPence` and `standardPackPence`, which are
  // already gross and must never be grossed again. That is why this card
  // wraps its prices in grossPence() and OneSearchPackageBuilder does not.
  const selectedItems = catalogue.filter((item) => selectedIds.has(item.id));
  // Net, because onRequest carries it on to a net-priced contract.
  const totalPence = selectedItems.reduce((sum, item) => sum + (item.retailPricePence ?? 0), 0);
  // What the customer READS is the sum of the grossed lines, not the grossed
  // sum, so the figures on screen always add up to the figure on screen. The
  // Groundsure basket pins the same property with a whole-penny test instead,
  // because its total must mirror the worker's to the penny; this card charges
  // nothing, so it can simply be additive by construction.
  const displayedTotalPence = selectedItems.reduce(
    (sum, item) => sum + grossPence(item.retailPricePence ?? 0),
    0,
  );
  const hasUnpricedSelection = selectedItems.some((item) => item.retailPricePence == null);

  async function handleSubmit(): Promise<void> {
    if (isRequesting || selectedItems.length === 0) return;
    setRequestFailed(false);
    const delivered = await onRequest(selectedItems.map(toSearchItem), totalPence);
    // Keep the ticks on failure so a retry doesn't make the user rebuild
    // their selection.
    if (delivered) setRequestSent(true);
    else setRequestFailed(true);
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Need something extra?
          </span>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Browse the full OneSearch product list — for non-standard transactions the packs don&rsquo;t cover.
          </p>
        </div>
        <svg
          className={[
            'h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200',
            expanded ? 'rotate-180' : '',
          ].join(' ')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-700/50">
          {requestSent ? (
            <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2.5 text-xs text-teal-700 dark:border-teal-800/40 dark:bg-teal-900/10 dark:text-teal-400">
              Request sent. OneSearch will confirm exact pricing within 24 hours and your
              conveyancer will be in touch to arrange it.
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-700 dark:border-teal-800/40 dark:bg-teal-900/10 dark:text-teal-400">
                Most of these don&rsquo;t have a confirmed online price yet. Tick what you
                need and request it — OneSearch will confirm exact pricing within 24
                hours rather than you having to ask your conveyancer to chase it.
              </div>

              <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto">
                {catalogue.map((item) => {
                  const reason = reasonForItem(item, areaCapabilities, conveyancerRequestedCodes);
                  const isChecked = selectedIds.has(item.id);
                  return (
                    <li key={item.id}>
                      <label className="flex items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggle(item.id)}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500 dark:border-gray-600"
                        />
                        <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
                          <div>
                            <span className="text-sm text-gray-800 dark:text-gray-200">{item.name}</span>
                            {reason && (
                              <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-medium text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
                                {reason}
                              </span>
                            )}
                          </div>
                          <span className="shrink-0 font-mono text-xs tabular-nums text-gray-500 dark:text-gray-400">
                            {item.retailPricePence != null ? pounds(grossPence(item.retailPricePence)) : 'TBC'}
                          </span>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-3 space-y-2 border-t border-gray-100 pt-3 dark:border-gray-700/50">
                {requestFailed && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 dark:border-red-800/40 dark:bg-red-900/10 dark:text-red-400"
                  >
                    We couldn&rsquo;t get your request through to OneSearch. Your selection is
                    still here &mdash; try again, or ask your conveyancer to order these
                    directly.
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{selectedItems.length} selected</span>
                  <span className="font-mono tabular-nums">
                    {hasUnpricedSelection
                      ? `From ${pounds(displayedTotalPence)} + TBC`
                      : pounds(displayedTotalPence)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isRequesting || selectedItems.length === 0}
                  className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-600 dark:hover:bg-teal-500"
                >
                  {isRequesting
                    ? 'Sending…'
                    : requestFailed
                      ? 'Try again'
                      : `Request ${selectedItems.length || ''} search${selectedItems.length === 1 ? '' : 'es'}`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
