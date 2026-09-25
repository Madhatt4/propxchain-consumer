import { useState, useMemo } from 'react';

import { tmGroupProvider, type SearchItem } from '../../services/searchProviderData';
import { resolveTmGroupPacks } from '../../services/tmGroupPacks';
import { getRequiredSearchIds } from './tmGroupCardHelpers';
import { useTmGroupCatalogueQuote } from './useTmGroupCatalogueQuote';
import TmGroupIncludedList from './TmGroupIncludedList';
import TmGroupPackPicker from './TmGroupPackPicker';
import TmGroupQuoteSummary from './TmGroupQuoteSummary';
import TmGroupSearchRow from './TmGroupSearchRow';
import { LoadingHouse } from '../ui/LoadingHouse';

import type { StructuredAddress } from '../../services/pafAddress';


interface SearchPackageBuilderProps {
  postcode: string;
  localAuthority: string;
  /** Structured address from the Stage-1 listing, when the seller completed it. */
  addressParts?: StructuredAddress | null;
  /** Free-text fallback when the listing has no structured address. */
  propertyAddress?: string;
  onOrder?: (searches: SearchItem[], estimatePence: number) => void;
  isOrdering?: boolean;
  /** Refusal the person can act on — unpriceable address, unsupported country. */
  errorMessage?: string | null;
}

export default function SearchPackageBuilder({
  postcode,
  localAuthority,
  addressParts,
  propertyAddress = '',
  onOrder,
  isOrdering = false,
  errorMessage = null,
}: SearchPackageBuilderProps): JSX.Element {
  const requiredIds = useMemo(() => getRequiredSearchIds(localAuthority), [localAuthority]);

  const areaSpecificSearches = tmGroupProvider.additionalSearches.filter(
    (s) => s.category === 'area-specific' && requiredIds.includes(s.id),
  );

  // Area-specific required searches start auto-checked
  const [selectedAddOns, setSelectedAddOns] = useState<Set<string>>(
    () => new Set(areaSpecificSearches.map((s) => s.id)),
  );
  const [uncheckedRequired, setUncheckedRequired] = useState<Set<string>>(new Set());
  // null = build your own, which is what this card did before packs existed and
  // is deliberately still the default. A preset basket is an offer, not a
  // decision made on the customer's behalf.
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const packs = useMemo(() => resolveTmGroupPacks(), []);
  /**
   * Only an AVAILABLE pack counts as selected.
   *
   * An unavailable pack resolves to `itemIds: []` by design — it fails closed
   * rather than offering a shortened basket. But if `selectedPackId` still points
   * at one, `packItems` becomes empty and the basket loses the standard bundle
   * entirely: the customer would order nothing but their area-specific add-ons.
   * The picker disables unavailable packs, so this needs a data change to happen
   * (a code disappearing from the catalogue under a live selection) — which is
   * exactly the kind of thing that does happen, and it fails toward selling too
   * few searches. Yoda, PR #261.
   */
  const selectedPack = useMemo(
    () => packs.find((pack) => pack.id === selectedPackId && pack.isAvailable) ?? null,
    [packs, selectedPackId],
  );
  // One quote per property, whole catalogue. See the hook for why.
  const { quote, isQuoting, linePence, unpriceable, refresh, refreshCount } = useTmGroupCatalogueQuote(
    postcode, localAuthority, addressParts, propertyAddress,
  );
  // An unpriced line on the FIRST answer says "press Refresh quote"; after a
  // refresh it is still unpriced, so it says "Not available here". See the hook.
  const suggestRefresh = refreshCount === 0;

  /**
   * The basket that gets quoted and ordered.
   *
   * With no pack chosen: the standard bundle plus whatever add-ons are ticked —
   * the card's original behaviour, unchanged.
   *
   * With a pack chosen: EXACTLY that pack's searches, plus any add-on the person
   * has ticked. The pack REPLACES the standard bundle rather than adding to it,
   * because the two overlap — tmGroup's regulated packs carry a regulated water
   * search and a Groundsure environmental where the standard bundle carries the
   * official drainage enquiry and a Landmark one. Merging them would sell two
   * environmental reports on the same property and charge for both.
   */
  const allCatalogueItems = useMemo(
    () => [...tmGroupProvider.standardPackSearches, ...tmGroupProvider.additionalSearches],
    [],
  );

  const packItems = useMemo<SearchItem[]>(
    () =>
      selectedPack
        ? selectedPack.itemIds
            .map((id) => allCatalogueItems.find((item) => item.id === id))
            .filter((item): item is SearchItem => item !== undefined)
        : tmGroupProvider.standardPackSearches,
    [selectedPack, allCatalogueItems],
  );

  // A search already inside the chosen pack must not also appear as an unticked
  // optional extra — it reads as "not included" for something they are buying.
  const optionalSearches = useMemo(
    () =>
      tmGroupProvider.additionalSearches.filter(
        (s) => s.category === 'optional' && !packItems.some((item) => item.id === s.id),
      ),
    [packItems],
  );

  const selectedSearches = useMemo<SearchItem[]>(() => {
    const packIds = new Set(packItems.map((item) => item.id));
    return [
      ...packItems,
      ...tmGroupProvider.additionalSearches.filter(
        (s) => selectedAddOns.has(s.id) && !packIds.has(s.id),
      ),
    ];
  }, [packItems, selectedAddOns]);

  const productCodes = useMemo(
    () => selectedSearches.map((s) => s.productType).filter((c): c is string => Boolean(c)),
    [selectedSearches],
  );

  /**
   * What the customer pays for what they have ticked.
   *
   * Sum of the selected lines, not the quote total — the quote covers the whole
   * catalogue, so its own gross is the price of everything. Safe to sum because
   * per-line prices do not vary with basket composition; verified against demo20
   * on 2026-08-16 (see useTmGroupCatalogueQuote).
   */
  const selectedTotalPence = useMemo(
    () => productCodes.reduce((sum, code) => sum + (linePence.get(code) ?? 0), 0),
    [productCodes, linePence],
  );

  /**
   * The Local Authority and water fees inside the SELECTED basket — the
   * VAT-exempt pass-through we charge at cost. Summed from the selected lines,
   * not taken from the catalogue quote, whose disbursement covers products
   * nobody is buying.
   */
  const selectedDisbursementPence = useMemo(() => {
    const selected = new Set(productCodes);
    return (quote?.lines ?? [])
      .filter((l) => selected.has(l.productType))
      .reduce((sum, l) => sum + l.nonVatablePence, 0);
  }, [productCodes, quote]);

  /**
   * Orderable when the property priced AND every selected product has a price.
   *
   * Deliberately NOT isQuoteOrderable(quote): that asks "did the whole catalogue
   * price?", and one unavailable optional extra would block a basket that does
   * not include it. The question that matters is whether THIS basket is priced.
   */
  // Note the test is "not unpriceable", NOT "price > 0". A £0 line is not
  // necessarily unpriced: TMGCon29 quotes at £0 WITH a real turnaround because it
  // is included in the personal search. Only £0 AND a null turnaround means
  // tmGroup could not price it, which is what unpricedProductTypes carries.
  // The total still has to be positive — £0 through Stripe is a free order.
  const orderable =
    quote?.success === true &&
    !isQuoting &&
    productCodes.length > 0 &&
    productCodes.every((c) => !unpriceable.has(c)) &&
    selectedTotalPence > 0;

  function toggleAddOn(id: string, isRequired: boolean): void {
    setSelectedAddOns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (isRequired) {
          setUncheckedRequired((r) => new Set([...r, id]));
        }
      } else {
        next.add(id);
        if (isRequired) {
          setUncheckedRequired((r) => {
            const nr = new Set(r);
            nr.delete(id);
            return nr;
          });
        }
      }
      return next;
    });
  }

  // Marc, 2026-08-18: "I wanted it in the centre of the screen, not tucked away
  // on a card at the bottom." While the catalogue quote is in flight there are
  // no prices to show against any row, so the whole card is the wait. Selection
  // state survives underneath — it lives in this component, not the rows.
  if (isQuoting) {
    return (
      <LoadingHouse
        title="Getting a live price for this property…"
        detail="tmGroup are pricing every search for this address. This can take up to 20 seconds the first time."
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* selectedPackId is the RESOLVED pack's id, not the raw state: if the
          selected pack becomes unavailable the basket falls back to the standard
          bundle, and the picker must show that rather than a checked, disabled
          radio sitting next to an unchecked "Build your own". Yoda, PR #261. */}
      <TmGroupPackPicker
        packs={packs}
        selectedPackId={selectedPack?.id ?? null}
        onSelect={setSelectedPackId}
        linePence={linePence}
        unpriceable={unpriceable}
      />

      {/* The chosen basket, itemised. Not tickable: it is the pack. */}
      <TmGroupIncludedList
        heading={selectedPack ? `${selectedPack.name} — included` : 'Standard bundle — always included'}
        items={packItems}
        linePence={linePence}
        unpriceable={unpriceable}
        suggestRefresh={suggestRefresh}
      />

      {/* Required for your area */}
      {areaSpecificSearches.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
            Required for your area
          </p>
          <div className="divide-y divide-amber-100 rounded-lg border border-amber-200 bg-[#F0F5F0] dark:divide-amber-900/30 dark:border-amber-800/40 dark:bg-[#1A2A1E]">
            {areaSpecificSearches.map((search) => {
              const isChecked = selectedAddOns.has(search.id);
              const isUnchecked = uncheckedRequired.has(search.id);
              return (
                <div key={search.id} className="space-y-1 px-4 py-3">
                  <TmGroupSearchRow
                    name={search.name}
                    pricePence={linePence.get(search.productType ?? '') ?? 0}
                    isChecked={isChecked}
                    onToggle={() => toggleAddOn(search.id, true)}
                    unavailable={unpriceable.has(search.productType ?? '')}
                    suggestRefresh={suggestRefresh}
                    warn
                  />
                  {isUnchecked && (
                    <p className="ml-7 text-xs text-amber-600 dark:text-amber-400">
                      This search is recommended for your area. You can proceed without it, but your solicitor may require it later.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Optional searches */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Optional
        </p>
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
          {optionalSearches.map((search) => {
            const isChecked = selectedAddOns.has(search.id);
            return (
              <div key={search.id} className="px-4 py-3">
                <TmGroupSearchRow
                  name={search.name}
                  pricePence={linePence.get(search.productType ?? '') ?? 0}
                  isChecked={isChecked}
                  onToggle={() => toggleAddOn(search.id, false)}
                  unavailable={unpriceable.has(search.productType ?? '')}
                  suggestRefresh={suggestRefresh}
                />
              </div>
            );
          })}
        </div>
      </div>

      <TmGroupQuoteSummary
        quote={quote}
        isQuoting={isQuoting}
        orderable={orderable}
        postcode={postcode}
        localAuthority={localAuthority}
        isOrdering={isOrdering}
        canOrder={Boolean(onOrder)}
        totalPence={selectedTotalPence}
        disbursementPence={selectedDisbursementPence}
        errorMessage={errorMessage}
        hasUnpricedLines={unpriceable.size > 0}
        onRefresh={refresh}
        onOrder={() => onOrder?.(selectedSearches, selectedTotalPence)}
      />
    </div>
  );
}
