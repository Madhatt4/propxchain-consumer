/**
 * One tmGroup quote per property, covering the WHOLE catalogue.
 *
 * Marc, 2026-08-16: "tmGroup isn't going to change their pricing of a search
 * every 5 minutes... the prices are pretty stable and only change if the
 * postcode changes."
 *
 * He is right, and quoting per basket-change was wrong in three ways: it fired a
 * real tmGroup draft on every checkbox, it left a window where the button showed
 * one basket's price and sent another (which is how an unpriceable Highways
 * enquiry reached a click on 2026-08-16), and it made people wait to see a price.
 *
 * Summing the cached per-line prices is safe because a product costs the same
 * alone as in a basket. Verified against demo20 on 2026-08-16: PSReport12 8340p
 * both ways, Con29DW 6540p both ways, EnviroschR 6810p both ways.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { logger } from '@/utils/logger';

import { tmGroupProvider } from '../../services/searchProviderData';
import { tmgroupService, tmGroupAddressFromParts, type TmGroupQuote } from '../../services/tmgroup.service';

import type { StructuredAddress } from '../../services/pafAddress';

interface CatalogueQuote {
  quote: TmGroupQuote | null;
  isQuoting: boolean;
  /** Gross pence per tmGroup product code. */
  linePence: Map<string, number>;
  /** Codes tmGroup could not price for this property (£0 AND a null turnaround). */
  unpriceable: Set<string>;
  /**
   * Ask tmGroup again for the SAME address. tmGroup's provider lookup on a new
   * draft has a timing gap (Rhys, 2026-08-18) and on 2026-08-19 Marc's first
   * quote of the day came back with five lines unpriced that priced in full two
   * minutes later. The worker already retries; this is the person's own retry.
   */
  refresh: () => void;
  /** How many times refresh() has been pressed for this address. Resets on address change. */
  refreshCount: number;
}

/** Every product code in the tmGroup catalogue. Constant — the catalogue is static. */
const ALL_PRODUCT_CODES = [
  ...tmGroupProvider.standardPackSearches,
  ...tmGroupProvider.additionalSearches,
]
  .map((s) => s.productType)
  .filter((c): c is string => Boolean(c));

export function useTmGroupCatalogueQuote(
  postcode: string,
  localAuthority: string,
  addressParts: StructuredAddress | null | undefined,
  propertyAddress: string,
): CatalogueQuote {
  const [quote, setQuote] = useState<TmGroupQuote | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  // Refreshes are counted PER ADDRESS. Storing the key with the count means a
  // new address reads as zero refreshes without a reset effect — which would
  // otherwise re-fire the quote a second time (a real tmGroup draft) on every
  // address change after the first refresh.
  const [refreshes, setRefreshes] = useState<{ key: string; n: number }>({ key: '', n: 0 });

  /**
   * Depend on the address BY VALUE, not by object identity.
   *
   * TransactionFlowPage builds `addressParts` inline in JSX, so it is a new
   * object on every render. Keying on its identity would fire a real tmGroup
   * draft every time the page re-rendered for any reason.
   */
  const addressKey = useMemo(
    () =>
      JSON.stringify([
        addressParts?.addressLine1 ?? '',
        addressParts?.addressLine2 ?? '',
        addressParts?.town ?? '',
        addressParts?.county ?? '',
        addressParts?.postcode ?? '',
        propertyAddress,
        postcode,
        localAuthority,
      ]),
    [addressParts, propertyAddress, postcode, localAuthority],
  );

  const refreshCount = refreshes.key === addressKey ? refreshes.n : 0;
  const refresh = useCallback(
    () => setRefreshes((prev) => ({ key: addressKey, n: prev.key === addressKey ? prev.n + 1 : 1 })),
    [addressKey],
  );

  useEffect(() => {
    if (!tmgroupService.isEnabled() || !postcode) {
      setQuote(null);
      setIsQuoting(false);
      return;
    }

    let cancelled = false;
    setIsQuoting(true);

    void (async () => {
      const result = await tmgroupService.getQuote({
        productCodes: ALL_PRODUCT_CODES,
        address: tmGroupAddressFromParts(addressParts, propertyAddress, postcode, localAuthority),
      });
      // The property changed while this was in flight — a late answer for a
      // previous address must never paint prices for the current one.
      if (cancelled) return;
      if (!result.success) {
        logger.warn('tmGroup catalogue quote failed', result.error, result.message);
      }
      setQuote(result);
      setIsQuoting(false);
    })();

    return () => {
      cancelled = true;
    };
    // addressKey describes every input by value; listing the objects themselves
    // reintroduces the identity churn this exists to avoid. refreshCount is the
    // person's "ask again" for the same address.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressKey, refreshCount]);

  const linePence = useMemo(() => {
    const map = new Map<string, number>();
    quote?.lines?.forEach((l) => map.set(l.productType, l.grossPence));
    return map;
  }, [quote]);

  const unpriceable = useMemo(() => new Set(quote?.unpricedProductTypes ?? []), [quote]);

  return { quote, isQuoting, linePence, unpriceable, refresh, refreshCount };
}
