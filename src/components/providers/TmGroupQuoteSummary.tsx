/**
 * The price + order half of the tmGroup card, split out of SearchPackageBuilder
 * to keep that file under the 300-line rule.
 *
 * Presentational only. It decides nothing about whether an order may proceed —
 * `orderable` is computed by tmgroupService.isQuoteOrderable and passed in, so
 * the "may we charge for this?" question has exactly one answer in one place.
 */

import { RefreshCw } from 'lucide-react';

import { describeQuoteFailure, pence } from './tmGroupCardHelpers';

import type { TmGroupQuote } from '../../services/tmgroup.service';

interface TmGroupQuoteSummaryProps {
  quote: TmGroupQuote | null;
  isQuoting: boolean;
  orderable: boolean;
  /**
   * The SELECTED basket's total, not the quote's. The quote covers the whole
   * catalogue so its own grossPence is the price of everything, which is not
   * what anybody is buying.
   */
  totalPence: number;
  /** LA + water pass-through inside the selected basket, charged at cost. */
  disbursementPence: number;
  postcode: string;
  localAuthority: string;
  isOrdering: boolean;
  canOrder: boolean;
  errorMessage?: string | null;
  /** Any catalogue line unpriced — even one nobody has ticked. */
  hasUnpricedLines?: boolean;
  /** Ask tmGroup again for the same address. Absent = no button. */
  onRefresh?: () => void;
  onOrder: () => void;
}

export default function TmGroupQuoteSummary({
  quote,
  isQuoting,
  orderable,
  totalPence,
  disbursementPence,
  postcode,
  localAuthority,
  isOrdering,
  canOrder,
  errorMessage = null,
  hasUnpricedLines = false,
  onRefresh,
  onOrder,
}: TmGroupQuoteSummaryProps): JSX.Element {
  const total = totalPence;
  const disbursement = disbursementPence;

  return (
    <>
      {/* The total is the LIVE quote from a real tmGroup Draft — never a
          catalogue sum. tmGroup price per property (Local Authority £100-£300 by
          council, water £17-£98, tmGroup 2026-07-23), and the previous
          version of this card invented a total that fed straight into a charge. */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-700 dark:bg-gray-800/50">
        {/* Unreachable while SearchPackageBuilder shows the LoadingHouse for the
            whole card, kept so this component stays honest if rendered alone. */}
        {isQuoting && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Getting a live price for this property…
          </p>
        )}

        {!isQuoting && orderable && quote && (
          <>
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Total</p>
              <p className="font-mono tabular-nums text-lg font-semibold text-gray-900 dark:text-gray-100">
                {pence(total)}
              </p>
            </div>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              Includes VAT
              {disbursement > 0
                ? `, and ${pence(disbursement)} of Local Authority and water fees charged at cost`
                : ''}
              . Quoted for this property, not an estimate.
            </p>
          </>
        )}

        {/* An unpriceable property is NOT a £0 property. tmGroup answer 200 with
            every line at £0.00 and no failures when they cannot resolve a
            property's authorities, so saying nothing here would read as free. */}
        {!isQuoting && quote && !orderable && (
          <p className="text-sm text-amber-700 dark:text-amber-400">{describeQuoteFailure(quote)}</p>
        )}

        {/* Refresh quote. 2026-08-19: Marc's first catalogue quote of the day came
            back with five lines unpriced; two minutes later the same address
            priced in full. tmGroup's provider lookup on a NEW draft has a timing
            gap (Rhys, 2026-08-18) and the worker's retries can all land inside
            it. Offered whenever a line is unpriced or the quote failed — a
            person should never have to reload the page to ask again. */}
        {!isQuoting && quote && onRefresh && (hasUnpricedLines || !orderable) && (
          <button
            type="button"
            onClick={onRefresh}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-teal-600 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 dark:border-teal-400 dark:text-teal-300 dark:hover:bg-teal-900/30"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Refresh quote
          </button>
        )}

        {!isQuoting && !quote && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {postcode
              ? 'Select your searches to get a live price for this property.'
              : 'Add the property address and postcode to get a price.'}
          </p>
        )}

        {postcode && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Searches for {postcode}
            {localAuthority ? ` · ${localAuthority}` : ''}
          </p>
        )}
      </div>

      {errorMessage && <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>}

      {/* Enabled ONLY on an orderable quote. isQuoteOrderable refuses an
          incomplete quote, any unpriced or failed line, and a zero total —
          £0 through Stripe is a free order against searches costing £100-£300.

          isQuoting is in the disable list deliberately. Ticking a search starts a
          400ms debounce plus a network round trip, and `orderable` still reflects
          the PREVIOUS basket for that whole window while onOrder would send the
          NEW one. Clicking in the gap orders a basket nothing has priced — which
          is precisely what Marc hit on 2026-08-16: the card showed a price, the
          click returned "We could not price searches for this property". A stale
          quote must never be clickable. */}
      <button
        type="button"
        disabled={!orderable || isQuoting || isOrdering || !canOrder}
        onClick={onOrder}
        className={[
          'w-full rounded-lg px-4 py-3 text-sm font-semibold transition-colors',
          orderable && !isQuoting && !isOrdering && canOrder
            ? 'bg-teal-600 text-white hover:bg-teal-700'
            : 'cursor-not-allowed bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
        ].join(' ')}
      >
        {isOrdering
          ? 'Taking you to payment…'
          : isQuoting
            ? 'Pricing…'
            : orderable
              ? `Order searches — ${pence(total)}`
              : 'Order searches'}
      </button>
    </>
  );
}
