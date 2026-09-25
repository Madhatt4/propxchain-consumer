import { useCallback, useMemo, useState } from 'react';
import GroundsureProductListCard from './GroundsureProductListCard';
import {
  groundsureBundles,
  groundsureRegionals,
  groundsureSingles,
  grossPence,
  vatPenceOn,
  type SearchItem,
} from '../../services/searchProviderData';

interface GroundsureBundlePickerProps {
  postcode: string;
  /** Area capability tags from the postcode/LA detector (e.g. 'coal-mining'). */
  areaCapabilities?: string[];
  /** Panel item ids the buyer/seller's conveyancer has explicitly asked for. */
  conveyancerRequestedIds?: string[];
  onOrder: (items: SearchItem[], totalPence: number) => void;
  isOrdering: boolean;
  /** Why the last order attempt failed. Shown above the button so it isn't missed. */
  errorMessage?: string | null;
  /** Rendered in the same place as the error: a confirmation the order needs
   *  before payment, such as lines Groundsure declined for this property. */
  notice?: React.ReactNode;
}

function pence(amount: number): string {
  return `£${(amount / 100).toFixed(2)}`;
}

export default function GroundsureBundlePicker({
  postcode,
  areaCapabilities = [],
  conveyancerRequestedIds = [],
  onOrder,
  isOrdering,
  errorMessage = null,
  notice = null,
}: GroundsureBundlePickerProps): React.ReactElement {
  // Single bundle pick — radio-style. Default: no bundle (consumer browses singles).
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null);

  // Singles + regionals are checkbox add-ons, ticked in the sub-card below.
  // Held here rather than there so a bundle and its extras stay one basket
  // and one Stripe charge.
  const [selectedAddOns, setSelectedAddOns] = useState<Set<string>>(() => new Set());

  const toggleAddOn = useCallback((id: string): void => {
    setSelectedAddOns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const applyRecommended = useCallback((ids: string[]): void => {
    setSelectedAddOns((prev) => new Set([...prev, ...ids]));
  }, []);

  const { selectedBundle, selectedAddOnItems, netPence } = useMemo(() => {
    const bundle = selectedBundleId
      ? groundsureBundles.find((b) => b.id === selectedBundleId) ?? null
      : null;
    const addOns = [
      ...groundsureRegionals.filter((s) => selectedAddOns.has(s.id)),
      ...groundsureSingles.filter((s) => selectedAddOns.has(s.id)),
    ];
    return {
      selectedBundle: bundle,
      selectedAddOnItems: addOns,
      // Net: the Groundsure rate card is ex-VAT, so this is the sum of RRPs.
      netPence: (bundle?.pricePence ?? 0) + addOns.reduce((sum, s) => sum + s.pricePence, 0),
    };
  }, [selectedBundleId, selectedAddOns]);

  // VAT is added once, on the summed net — not per line — so a multi-report
  // basket cannot drift from its own total by accumulated half-penny rounding.
  // groundsure-worker rounds the same way and re-prices server-side anyway.
  const vatPence = vatPenceOn(netPence);
  const totalPence = netPence + vatPence;

  const orderedItems = selectedBundle ? [selectedBundle, ...selectedAddOnItems] : selectedAddOnItems;

  function handleOrder(): void {
    if (orderedItems.length === 0) return;
    onOrder(orderedItems, totalPence);
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Direct from Groundsure at RRP. Bundles cover the standard case; add anything
        extra your property needs underneath.
      </p>

      {/* Bundles — single-pick, the front door */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Bundles — pick one
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {groundsureBundles.map((bundle) => {
            const isSelected = selectedBundleId === bundle.id;
            return (
              <button
                type="button"
                key={bundle.id}
                onClick={() => setSelectedBundleId(isSelected ? null : bundle.id)}
                aria-pressed={isSelected}
                className={[
                  'rounded-lg border p-3 text-left transition-colors',
                  isSelected
                    ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-900/10'
                    : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-[#0F1729] dark:hover:border-gray-600',
                ].join(' ')}
              >
                <div className="flex items-center justify-between">
                  <span className="font-dm-sans text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {bundle.name}
                  </span>
                  {isSelected && (
                    <svg className="h-4 w-4 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <p className="mt-1 font-mono tabular-nums text-sm text-teal-600 dark:text-teal-400">
                  {pence(grossPence(bundle.pricePence))}
                </p>
                {bundle.turnaround && (
                  <p className="mt-0.5 font-geist-mono text-[10px] text-gray-400 dark:text-gray-500">
                    {bundle.turnaround}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Every other Groundsure product — tick-box, with the reason for each pre-tick */}
      <GroundsureProductListCard
        areaCapabilities={areaCapabilities}
        conveyancerRequestedIds={conveyancerRequestedIds}
        selectedIds={selectedAddOns}
        onToggle={toggleAddOn}
        onApplyRecommended={applyRecommended}
      />

      {/* Every price here is VAT-INCLUSIVE, per-line included, from 2026-09-09:
          the figure a customer reads is the figure they pay. The rate card
          itself stays ex-VAT — it is the net side of the margin and mirrors
          groundsure-worker's, so display grosses it up rather than restating it.

          The TOTAL is still net + VAT-on-the-summed-net, not the sum of the
          grossed lines, because that is exactly what groundsure-worker stamps
          as retail_gbp and payment-worker charges; computing it any other way
          could show a total Stripe then contradicts. The two agree for every
          price in the card today and a test pins that, so the lines a customer
          adds up always reach the Total they are shown. */}
      {orderedItems.length > 0 && (
        <div className="rounded-lg bg-gray-50 px-4 py-4 dark:bg-gray-800/50">
          <ul className="space-y-1.5">
            {orderedItems.map((item) => (
              <li
                key={item.id}
                className="flex justify-between text-sm text-gray-600 dark:text-gray-400"
              >
                <span>{item.name}</span>
                <span className="font-mono tabular-nums">{pence(grossPence(item.pricePence))}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 border-t border-gray-200 pt-2 dark:border-gray-700">
            <div className="flex justify-between">
              <span className="font-medium text-gray-900 dark:text-gray-100">Total</span>
              <span className="font-mono tabular-nums text-lg font-semibold text-teal-600 dark:text-teal-400">
                {pence(totalPence)}
              </span>
            </div>
            <p className="mt-0.5 text-right text-[10px] text-gray-400 dark:text-gray-500">
              includes {pence(vatPence)} VAT
            </p>
          </div>
          {postcode && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Pricing for {postcode}</p>
          )}
        </div>
      )}

      {notice}

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
        disabled={isOrdering || orderedItems.length === 0}
        className="w-full rounded-lg bg-teal-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-600 dark:hover:bg-teal-500"
      >
        {isOrdering
          ? 'Placing order…'
          : orderedItems.length === 0
            ? 'Pick a bundle or a search to order'
            : `Order ${orderedItems.length} search${orderedItems.length === 1 ? '' : 'es'} — ${pence(totalPence)}`}
      </button>
    </div>
  );
}
