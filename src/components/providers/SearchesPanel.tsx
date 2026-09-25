import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import SearchPackageBuilder from './SearchPackageBuilder';
import OneSearchPackageBuilder from './OneSearchPackageBuilder';
import OneSearchProductListCard from './OneSearchProductListCard';
import GroundsureBundlePicker from './GroundsureBundlePicker';
import CollapsibleProviderCard from './CollapsibleProviderCard';
import SearchAreaNote from './SearchAreaNote';
import {
  tmGroupProvider,
  onesearchProvider,
  groundsureBundles,
  grossPence,
} from '../../services/searchProviderData';
import { searchOrderService } from '../../services/searchOrder.service';
import { onesearchService } from '../../services/onesearch.service';
import { groundsureService } from '../../services/groundsure.service';
import DroppedSearchesNotice from './DroppedSearchesNotice';
import { tmgroupService, tmGroupAddressFromParts } from '../../services/tmgroup.service';
import { describeQuoteFailure } from './tmGroupCardHelpers';
import { groundsureCodeFor } from '../../services/searchProviderData';
import { postcodeService } from '../../services/postcodeService';
import type { LocalAuthorityInfo } from '../../services/postcodeService';
import { analyzeLocationForSearches, getAreaCapabilities } from '../../utils/searchRegionMapping';
import { buildExplainerModel } from '../searches/explainer/searchExplainerModel';
import SearchesExplainerContent from '../searches/explainer/SearchesExplainerContent';
import ExplainerCard from '../explainer/ExplainerCard';
import ExplainerModal from '../explainer/ExplainerModal';
import { buildCacheKey, fetchNarration } from '@/services/searchesExplainer.service';
import { resolvePropertyBoundary } from '../../services/inspireBoundary.service';
import type { BoundarySource } from '../../services/propertyBoundary.service';
import {
  hasUsableStructuredAddress,
  pafAddressFromParts,
  parsePafAddress,
  type StructuredAddress,
} from '../../services/pafAddress';
import stripePaymentService from '@/services/stripePayment.service';
import { icpService } from '@/services/icp.service';
import { actingSidesFor, recordOnBehalf } from '@/services/onBehalf';
import { sendPaymentLink, DelegationError } from '@/services/delegation.service';
import { PaymentHandoffCard } from './PaymentHandoffCard';
import type { DealSide } from '@/services/shareParty.service';
import {
  buildGroundsureProductRef,
  buildOneSearchProductRef,
  buildTmGroupProductRef,
  clearSearchPendingState,
  loadSearchPendingState,
  readPendingSearchCheckoutFromUrl,
  saveSearchPendingState,
  SEARCH_STRIPE_SESSION_PARAM,
  type SearchCheckoutProvider,
} from '@/services/searchCheckoutResume';
import { logger } from '@/utils/logger';
import type { SearchItem } from '../../services/searchProviderData';
import type { ServiceProvider } from '../../types/provider.types';

interface SearchesPanelProps {
  postcode: string;
  transactionId: string;
  transactionType: 'sale' | 'purchase' | 'new-build';
  partyName: string;
  partyEmail: string;
  propertyAddress: string;
  /**
   * Structured address fields from the List Property form. Preferred over
   * `propertyAddress` for supplier orders, which need the parts separately
   * — flattening and re-parsing loses what the form already captured.
   * Optional: transactions predating structured capture only have the string.
   */
  addressParts?: StructuredAddress;
  /**
   * UPRN from the listing. Lets searches be ordered against the property's own
   * registered boundary instead of a box around the postcode. Optional: without
   * it the panel behaves exactly as it did before.
   */
  uprn?: string;
  orderedBy: 'buyer' | 'seller';
  onOrderComplete?: () => void;
  /**
   * Push the order's gross total into the transaction flow's running total
   * (TopBar). Fires only for committed payments — OneSearch + tmGroup —
   * not for Groundsure / Council Direct / Landmark quote-requests.
   */
  onProviderSelected?: (provider: ServiceProvider) => void;
  /**
   * Clear the existing order and let the user re-order. When provided, the
   * post-order confirmation card renders a "Re-order" button that calls
   * this. Caller is responsible for clearing the chain-side provider
   * selection (typically via useTransactionFlow.clearProvider).
   */
  onEdit?: () => void;
}

type PanelState = 'loading' | 'ready' | 'ordered' | 'error';
type OrderingProvider = 'onesearch' | 'onesearch-products' | 'tmgroup' | 'groundsure' | null;

/** A checkout prepared in a client's name, waiting for the client to pay (spec I3). */
interface PaymentHandoff {
  side: DealSide;
  provider: SearchCheckoutProvider;
  sessionId: string;
  url: string;
  totalPence: number;
}

function isCheckoutProvider(v: unknown): v is SearchCheckoutProvider {
  return v === 'onesearch' || v === 'groundsure' || v === 'tmgroup';
}

const NOT_PAID_YET = 'Not paid yet. Once they have paid from the email, check again and the order goes through.';
const CHECK_FAILED = 'Could not check just now. Try again in a moment.';

/** payment-worker answers "Payment not completed" for a session nobody has paid; anything else is a failed check, not an unpaid one. */
function isNotPaidYet(err: unknown): boolean {
  return err instanceof Error && /not completed/i.test(err.message);
}

function describePaymentLinkFailure(err: unknown): string {
  const code = err instanceof DelegationError ? err.code : 'request_failed';
  switch (code) {
    case 'no_mandate':
      return 'You no longer act for them on this deal, so the link cannot be sent.';
    case 'client_has_no_email':
      return 'They have no email address on their account. Hand the screen over instead.';
    case 'session_not_open':
      return 'This payment page has expired. Order again to get a fresh one.';
    default:
      return 'Could not send the link just now. Try again, or hand the screen over.';
  }
}

interface OrderSummary {
  provider: string;
  searches: SearchItem[];
  /** Whose name the order was paid in (agent CRM); absent for a party's own order. */
  paidBy?: DealSide;
  /** VAT-INCLUSIVE, for all three suppliers as of 2026-08-21. */
  totalPence: number;
  /**
   * VAT contained within totalPence. Rendered on the confirmation because that
   * screen is the customer's VAT receipt, and a VAT receipt has to show the tax
   * charged alongside our VAT number. Optional so a resumed pre-2026-08-21
   * order, whose stashed state has no vatPence, simply omits the line rather
   * than asserting a zero that would misstate the tax taken.
   */
  vatPence?: number;
  ourReference?: string;
  supplierReference?: string;
}

function pence(amount: number): string {
  return `£${(amount / 100).toFixed(2)}`;
}

/**
 * The amount Stripe will actually charge, in pence.
 *
 * payment-worker prices a search checkout from the `retail_gbp` the supplier
 * worker stamped on the order row (`priceFromSearchOrder`), never from
 * anything the client sends. So once we have that figure back it is the only
 * total worth displaying — the catalogue sum the picker showed is an estimate
 * that can drift (per-property pricing, a rate-card change, an area tier).
 * Falls back to the estimate when the worker returned no figure at all, which
 * in practice means mock mode.
 *
 * The three outcomes are distinct, and callers must not collapse them:
 *
 *   estimatePence  the worker sent NO figure — `undefined` or `null`, i.e.
 *                  mock mode or a response with the field absent. The
 *                  catalogue sum is the best we have and is safe to show.
 *                  Callers holding pence must pass `undefined` rather than
 *                  dividing an absent value, or they arrive here as NaN.
 *   null           the worker sent a figure that cannot be charged. Not the
 *                  same as sending nothing: a worker that stamps a price has
 *                  failed if that price is unusable, and falling back to the
 *                  estimate would paper over it — we would show a plausible
 *                  total while payment-worker charges from the row, which
 *                  holds the bad number. Treat as a failed order and say so.
 *   a number       the charge, in pence.
 *
 * On 2026-08-29 groundsure-worker stamped `retail_gbp = 0` and the old
 * `Number.isFinite` guard passed it straight through, because 0 is finite.
 * Stripe then accepted a £0.00 checkout.
 *
 * The guard is on the ROUNDED pence, not the pounds: 0.001 is a positive
 * number that rounds to 0p, so a pounds-only check would hand Stripe the same
 * £0.00 by a longer route.
 */
function authoritativeTotalPence(
  retailGbp: number | undefined,
  estimatePence: number,
  providerLabel: string,
): number | null {
  if (typeof retailGbp !== 'number') return estimatePence;
  const actual = Math.round(retailGbp * 100);
  // Number.isFinite on the rounded value catches NaN and Infinity too —
  // Math.round preserves both, and `NaN <= 0` is false, so an isFinite check
  // has to come first or NaN escapes.
  if (!Number.isFinite(actual) || actual <= 0) {
    logger.error(`${providerLabel} returned an unchargeable price`, { retailGbp });
    return null;
  }
  if (actual !== estimatePence) {
    logger.info(`${providerLabel} priced the order differently from the catalogue estimate`, {
      estimatePence,
      actualPence: actual,
    });
  }
  return actual;
}

/**
 * OneSearch from 2026-08-20: the worker stamps a GROSS retail_gbp and returns the
 * VAT inside it, so the audit row records a real split rather than the zero above.
 *
 * `workerVatGbp` is preferred over deriving, because the worker is the authority
 * on what was actually charged. The 1/6th fallback covers mock mode (no worker
 * call) and any pre-VAT-split row, where an unqualified charge is VAT-INCLUSIVE
 * by HMRC default — the same rule that made the flat ex-VAT charge a defect.
 */
function incVatAmounts(
  totalPence: number,
  workerVatGbp?: number,
): { subtotalPence: number; vatPence: number } {
  const vatPence =
    typeof workerVatGbp === 'number'
      ? Math.round(workerVatGbp * 100)
      : Math.round(totalPence / 6);
  return { subtotalPence: totalPence - vatPence, vatPence };
}

// Display metadata for the two Stripe-gated suppliers. Kept in one place
// because each provider's ServiceProvider descriptor is built twice — once on
// the mock-mode path and once on the resume-after-Stripe path — and the two
// have to agree or the transaction's running total disagrees with itself.
const PROVIDER_META: Record<
  SearchCheckoutProvider,
  { label: string; logoInitials: string; turnaroundMinutes: number; via: string }
> = {
  onesearch: {
    label: 'OneSearch',
    logoInitials: 'OS',
    turnaroundMinutes: 5 * 24 * 60,
    via: 'via PISCES',
  },
  groundsure: {
    label: 'Groundsure (via PropXchain)',
    logoInitials: 'GS',
    turnaroundMinutes: 2 * 24 * 60,
    via: 'direct from Groundsure',
  },
  tmgroup: {
    label: 'tmGroup',
    logoInitials: 'TM',
    turnaroundMinutes: 5 * 24 * 60,
    via: 'via tmConnect',
  },
};

function buildProviderSelection(
  provider: SearchCheckoutProvider,
  searchCount: number,
  totalPence: number,
): ServiceProvider {
  const meta = PROVIDER_META[provider];
  return {
    id: provider,
    name: meta.label,
    category: 'searches',
    description: `${searchCount} ${meta.label} search${searchCount === 1 ? '' : 'es'} ${meta.via}`,
    priceInPence: totalPence,
    currency: 'GBP',
    averageRating: 0,
    totalReviews: 0,
    averageTurnaroundMinutes: meta.turnaroundMinutes,
    isActive: true,
    logoInitials: meta.logoInitials,
  };
}

// Capability tags map to provider-specific SearchItem IDs. Add to either side
// as we extend area detection or product coverage.
const CAPABILITY_TO_ITEM_IDS: Record<string, string[]> = {
  'coal-mining': ['onesearch-coal-con29m', 'groundsure-con29m-coal'],
  brine: ['groundsure-cheshire-salt'],
  'tin-mining': ['groundsure-metalliferous-mining'],
  'stone-mining': ['groundsure-stone-mining'],
};



// The save/load/clear pending-state helpers live in searchCheckoutResume.ts
// now, not here — PaymentSuccessPage.tsx (a different route, mounted after
// the Stripe redirect) needs to read the same stash to know which
// transaction to route back to, so it can't stay private to this component.

// Strip the return query param after reading it so a page refresh or
// remount doesn't re-run the resume flow against an already-consumed
// session id. Mirrors HMLRTitlePullButton.tsx's stripReturnParamFromUrl.
function stripSearchReturnParamFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(SEARCH_STRIPE_SESSION_PARAM);
  window.history.replaceState({}, '', url.toString());
}

function SharedSearchPoolCallout(): React.ReactElement {
  return (
    <div className="rounded-xl border border-[#84A98C]/30 bg-[#84A98C]/5 p-4 dark:border-[#9CB8A4]/20 dark:bg-[#9CB8A4]/5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#84A98C]/15 text-[#5F8A68] dark:bg-[#9CB8A4]/10 dark:text-[#9CB8A4]">
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
        </div>
        <div>
          <h4 className="font-dm-sans text-sm font-semibold text-gray-900 dark:text-gray-100">
            Shared Search Pool
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
            Either party can order searches. Whoever orders first, the other side sees
            &ldquo;completed by [party]&rdquo;. Results are shared with both conveyancers.
            Enable <span className="font-medium text-[#5F8A68] dark:text-[#9CB8A4]">Turbo Mode</span> on
            the transaction to allow seller-first searches and speed up your chain.
          </p>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton(): React.ReactElement {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-gray-200 dark:bg-gray-700" />
      <div className="h-4 w-64 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-64 rounded-xl bg-gray-100 dark:bg-gray-800" />
    </div>
  );
}

function OrderConfirmation({
  summary,
  postcode,
  laName,
  onEdit,
}: {
  summary: OrderSummary;
  postcode: string;
  laName: string;
  onEdit?: () => void;
}): React.ReactElement {
  return (
    <div className="rounded-xl border border-[#0D9488]/30 bg-[#0D9488]/5 p-6 dark:border-[#14B8A6]/20 dark:bg-[#14B8A6]/5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0D9488]/15 text-[#0D9488] dark:bg-[#14B8A6]/10 dark:text-[#14B8A6]">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h3 className="font-fraunces text-lg font-semibold text-gray-900 dark:text-gray-100">
            Searches Ordered
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {postcode}
            {laName ? ` · ${laName}` : ''}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">Provider</span>
          <span className="font-dm-sans text-gray-900 dark:text-gray-100">{summary.provider}</span>
        </div>
        {summary.paidBy && (
          <div className="flex items-center justify-between text-sm" data-testid="paid-by">
            <span className="font-medium text-gray-700 dark:text-gray-300">Paid by</span>
            <span className="font-dm-sans text-gray-900 dark:text-gray-100">the {summary.paidBy}, in their own name</span>
          </div>
        )}
        {summary.ourReference && (
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">Reference</span>
            <span className="font-geist-mono text-xs text-gray-600 dark:text-gray-400">
              {summary.ourReference}
            </span>
          </div>
        )}
        {summary.supplierReference && (
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">Supplier ref</span>
            <span className="font-geist-mono text-xs text-gray-600 dark:text-gray-400">
              {summary.supplierReference}
            </span>
          </div>
        )}
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Searches ordered
          </p>
          <ul className="space-y-1">
            {summary.searches.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"
              >
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#0D9488] dark:bg-[#14B8A6]" />
                {s.name}
              </li>
            ))}
          </ul>
        </div>
        {/* This block is the customer's VAT receipt, so it shows the tax charged
            and our VAT number. Both are required on a VAT invoice; the total is
            VAT-inclusive for all three suppliers as of 2026-08-21. */}
        <div className="border-t border-[#0D9488]/20 pt-3 dark:border-[#14B8A6]/15">
          {typeof summary.vatPence === 'number' && (
            <>
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>Subtotal</span>
                <span className="font-geist-mono tabular-nums">
                  {pence(summary.totalPence - summary.vatPence)}
                </span>
              </div>
              {/* "VAT", not "VAT (20%)". This receipt is shared by all three
                  suppliers, and a tmGroup total is NOT 20% of its subtotal: it
                  mixes our VAT-bearing sale price with Local Authority and water
                  disbursements passed through AT COST. Printing a rate we did not
                  apply would misstate the tax on every tmGroup order. The single-
                  supplier pickers, where the rate really is a flat 20%, keep it. */}
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>VAT</span>
                <span className="font-geist-mono tabular-nums">{pence(summary.vatPence)}</span>
              </div>
            </>
          )}
          <div className="mt-1 flex items-center justify-between">
            <span className="font-medium text-gray-700 dark:text-gray-300">Total paid</span>
            <span className="font-geist-mono tabular-nums text-lg font-semibold text-[#0D9488] dark:text-[#14B8A6]">
              {pence(summary.totalPence)}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
            PropXchain Ltd · VAT registration number GB 524 6852 77
          </p>
        </div>

        {onEdit && (
          <div className="border-t border-[#0D9488]/20 pt-3 dark:border-[#14B8A6]/15">
            <button
              type="button"
              onClick={() => {
                const confirmed = window.confirm(
                  'Re-order searches?\n\nThis clears the current order from your transaction record so you can place a new one. The provider-side order is not cancelled — contact the provider directly if you need to undo a real order.',
                );
                if (confirmed) onEdit();
              }}
              className="font-dm-sans text-xs text-gray-500 underline hover:text-[#0D9488] dark:text-gray-400 dark:hover:text-[#14B8A6]"
            >
              Re-order searches
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function SearchesPanel({
  postcode,
  transactionId,
  transactionType,
  partyName: _partyName,
  partyEmail: _partyEmail,
  propertyAddress,
  addressParts,
  uprn,
  orderedBy,
  onOrderComplete,
  onProviderSelected,
  onEdit,
}: SearchesPanelProps): React.ReactElement {
  const [panelState, setPanelState] = useState<PanelState>('loading');
  const [localAuthority, setLocalAuthority] = useState<LocalAuthorityInfo | null>(null);
  const [isOrdering, setIsOrdering] = useState<OrderingProvider>(null);
  // tmGroup is the only provider that can refuse for a reason the person can act
  // on -- an address we cannot price, or a country we do not cover. Silently
  // unsticking the button (what the other two do) would leave them re-clicking.
  const [tmGroupError, setTmGroupError] = useState<string | null>(null);
  // Groundsure and OneSearch used to do exactly that silent unstick. On
  // 2026-08-29 a Groundsure order failed upstream for weeks with no user-facing
  // sign at all — the button simply reset, which is indistinguishable from a
  // dead button, so the failure was invisible until someone read the console.
  const [groundsureError, setGroundsureError] = useState<string | null>(null);
  /** A priced Groundsure order the customer has not yet seen the reductions for. */
  const [pendingDropped, setPendingDropped] = useState<{
    names: string[];
    pending: Awaited<ReturnType<typeof groundsureService.placeOrderForProperty>>;
    searches: SearchItem[];
    totalPence: number;
  } | null>(null);
  const [oneSearchError, setOneSearchError] = useState<string | null>(null);
  const [orderSummary, setOrderSummary] = useState<OrderSummary | null>(null);
  // Agent CRM (spec I3): the side the viewer acts for on this deal, from the
  // data. Payment for an assisted order is the client's, so the checkout is
  // handed over or emailed rather than opened on the agent's own account.
  const [assistedFor, setAssistedFor] = useState<DealSide | null>(null);
  const [handoff, setHandoff] = useState<PaymentHandoff | null>(null);
  const [handoffSentTo, setHandoffSentTo] = useState<string | null>(null);
  const [handoffBusy, setHandoffBusy] = useState<'sending' | 'checking' | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [handoffNote, setHandoffNote] = useState<string | null>(null);
  useEffect(() => {
    if (!transactionId) return;
    let cancelled = false;
    void actingSidesFor(transactionId).then((sides) => {
      if (!cancelled) setAssistedFor(sides.includes(orderedBy) ? orderedBy : null);
    });
    return () => {
      cancelled = true;
    };
  }, [transactionId, orderedBy]);
  /**
   * How the search area resolves for this property, for display only. Shown
   * before the customer pays, because a fallback box is exactly the case where
   * the reports may not cover their plot. The order handlers resolve again at
   * order time and that call stays authoritative.
   */
  const [areaSource, setAreaSource] = useState<BoundarySource | null>(null);
  const [areaHalfSize, setAreaHalfSize] = useState<number | null>(null);

  useEffect(() => {
    if (!postcode) return undefined;
    let cancelled = false;
    void resolvePropertyBoundary({ uprn, postcode }).then((resolved) => {
      if (cancelled || !resolved) return;
      setAreaSource(resolved.source);
      setAreaHalfSize(resolved.halfSizeMetres);
    });
    return () => {
      cancelled = true;
    };
  }, [postcode, uprn]);

  /** Abandon a Groundsure order, telling the person why. Always unsticks the button. */
  function failGroundsure(message: string): void {
    setGroundsureError(message);
    setIsOrdering(null);
  }

  /** Abandon a OneSearch order, telling the person why. Always unsticks the button. */
  function failOneSearch(message: string): void {
    setOneSearchError(message);
    setIsOrdering(null);
  }

  // The postcode-lookup effect below and the Stripe-resume effect further
  // down both fire on mount with no ordering guarantee over which async
  // call resolves last — a page load with ?search_stripe_session_id=... on
  // it runs both. `setPanelState('ready')` uses the functional updater form
  // here specifically so it never downgrades an 'ordered' state the resume
  // effect already committed, regardless of which effect's network call
  // resolves last (the updater always sees the latest committed state, not
  // a value captured in this closure at effect-creation time).
  useEffect(() => {
    let cancelled = false;

    async function fetchLa(): Promise<void> {
      if (!postcode || !postcode.trim()) {
        setLocalAuthority(null);
        setPanelState((prev) => (prev === 'ordered' ? prev : 'ready'));
        return;
      }

      try {
        const info = await postcodeService.getLocalAuthorityInfo(postcode.trim());
        if (cancelled) return;
        setLocalAuthority(info);
        setPanelState((prev) => (prev === 'ordered' ? prev : 'ready'));
      } catch (err) {
        if (cancelled) return;
        logger.warn('Postcode lookup failed for', postcode, err);
        setLocalAuthority(null);
        setPanelState((prev) => (prev === 'ordered' ? prev : 'ready'));
      }
    }

    void fetchLa();
    return () => {
      cancelled = true;
    };
  }, [postcode]);

  // laName stays a plain string because ~8 call sites downstream (order rows,
  // PAF address assembly, the header) want the display name, not the record.
  const laName = useMemo(
    () => localAuthority?.adminDistrict ?? localAuthority?.adminCounty ?? '',
    [localAuthority],
  );

  const areaCapabilities = useMemo(
    () => (localAuthority ? getAreaCapabilities(localAuthority) : []),
    [localAuthority],
  );

  const areaRequiredItemIds = useMemo(
    () => areaCapabilities.flatMap((c) => CAPABILITY_TO_ITEM_IDS[c] ?? []),
    [areaCapabilities],
  );

  const explainerModel = useMemo(
    () => (localAuthority ? buildExplainerModel(analyzeLocationForSearches(localAuthority)) : null),
    [localAuthority],
  );

  const [narration, setNarration] = useState<string[] | null>(null);

  // Narration is an enhancement layered onto a card that is already complete,
  // so this effect never gates rendering and never surfaces an error.
  useEffect(() => {
    if (!explainerModel || !localAuthority) return undefined;
    let cancelled = false;

    const requiredSearchIds = explainerModel.required.map((entry) => entry.searchType.id);
    const cacheKey = buildCacheKey({
      localAuthorityName: laName,
      transactionType,
      capabilities: areaCapabilities,
      requiredSearchIds,
    });

    void fetchNarration(cacheKey, {
      localAuthorityName: laName,
      transactionType,
      capabilities: areaCapabilities,
      recommendations: [...explainerModel.required, ...explainerModel.recommended].map((entry) => ({
        searchTypeId: entry.searchType.id,
        reason: entry.reason,
        priority: entry.priority,
        confidence: entry.confidence,
      })),
      notNeeded: explainerModel.notNeeded.map((searchType) => searchType.name),
    }).then((result) => {
      if (!cancelled) setNarration(result);
    });

    return () => {
      cancelled = true;
    };
  }, [explainerModel, localAuthority, laName, transactionType, areaCapabilities]);

  // True only on genuine unmount (empty-deps effect below), never on a
  // dependency-driven re-run of the resume effect. Distinct from the
  // per-run `cancelled` pattern the postcode effect above uses: that
  // pattern would be actively wrong here (see resumeDispatchedRef comment)
  // since it would silently swallow the one legitimate in-flight resume as
  // soon as any unrelated re-render fired its cleanup.
  const resumeUnmountedRef = useRef(false);
  useEffect(() => {
    return () => {
      resumeUnmountedRef.current = true;
    };
  }, []);

  // Resume after returning from Stripe (Task 9). Order details
  // (searches/totalPence/ourReference/sessionId) were stashed in
  // localStorage before the redirect (see handleOneSearchOrder) since
  // control doesn't return to this render on the happy path — we rebuild
  // orderSummary from that stash. Two paths, mirroring
  // HMLRTitlePullButton.tsx:
  //   1. URL has ?search_stripe_session_id=... — PaymentSuccessPage just
  //      routed the user here after Stripe confirmed payment. Resume
  //      immediately.
  //   2. URL is clean but pending state exists for this transaction with a
  //      stashed sessionId — user closed the tab during checkout, or paid
  //      on another device/tab and came back here directly. Verify the
  //      session is paid; if yes, resume the same way.
  //
  // resumeDispatchedRef guards against a real re-entrancy bug: the parent
  // (TransactionFlowPage) passes onOrderComplete/onProviderSelected as
  // fresh inline callbacks on every render, so any unrelated re-render
  // during the in-flight verifySession call below (e.g. the adjacent
  // postcode effect resolving) gives this effect's deps new identities and
  // re-runs it. Without the guard, a second run would find the URL param
  // already stripped, fall into the orphan-recovery branch, see the
  // pending state hasn't been cleared yet (run 1 hasn't finished), and
  // dispatch a second concurrent verify+resume — resulting in a duplicate
  // onProviderSelected call, which writes a duplicate on-chain
  // provider_selected audit event via useTransactionFlow's selectProvider.
  // The ref persists across those re-runs (unlike a plain variable), so
  // once a resume has been dispatched for this mount it stays dispatched
  // regardless of how many times the effect re-runs while the original
  // call is still in flight.
  const resumeDispatchedRef = useRef(false);

  /**
   * A paid session becomes the ordered state: the summary, the running total,
   * the stage completion and, for an order paid in a client's name, the
   * on-behalf record. Shared by the return-from-Stripe resume and the agent's
   * "Check payment" after emailing the link.
   */
  const settleVerifiedSession = useCallback(async (sessionId: string): Promise<boolean> => {
    const verification = await stripePaymentService.verifySession(sessionId);
    if (resumeUnmountedRef.current) return false;
    if (!verification.verified || verification.type !== 'search') return false;
    const stash = loadSearchPendingState();
    const pending = stash && stash.transactionId === transactionId ? stash : null;
    // A paid session with no stash on this device (storage cleared, or the
    // agent checking from elsewhere) is still a placed order: the provider
    // worker places it from Stripe's webhook. Settle from what Stripe says.
    const provider = pending?.provider ?? (isCheckoutProvider(verification.provider) ? verification.provider : null);
    if (!provider) {
      logger.warn('Search checkout verified but no matching pending state', { sessionId, transactionId, hasPending: Boolean(stash) });
      return false;
    }
    const searches = pending?.searches ?? [];
    const totalPence = pending?.totalPence ?? verification.amountPaid;
    const paidBy = verification.onBehalfOf ?? pending?.onBehalfOf;
    setOrderSummary({
      vatPence: pending?.vatPence,
      provider: PROVIDER_META[provider].label,
      searches,
      totalPence,
      ourReference: pending?.ourReference,
      paidBy: paidBy ?? undefined,
    });
    // Contribute to the transaction flow's running total now that the payment is confirmed.
    onProviderSelected?.(buildProviderSelection(provider, searches.length, totalPence));
    clearSearchPendingState();
    setHandoff(null);
    setPanelState('ordered');
    onOrderComplete?.();
    if (paidBy) void recordOnBehalf(transactionId, paidBy, 'order_searches', provider);
    return true;
  }, [onOrderComplete, onProviderSelected, transactionId]);

  useEffect(() => {
    if (resumeDispatchedRef.current) return;

    async function resumeFromSession(sessionId: string): Promise<void> {
      try {
        await settleVerifiedSession(sessionId);
      } catch (err) {
        if (resumeUnmountedRef.current) return;
        logger.warn('Search checkout verification failed on return', err);
      }
    }

    const urlSessionId = readPendingSearchCheckoutFromUrl(new URL(window.location.href));
    if (urlSessionId) {
      // Strip immediately (before the async verify), matching
      // HMLRTitlePullButton.tsx — a remount or refresh while verification
      // is in flight must not re-trigger this against an already-consumed
      // session id.
      stripSearchReturnParamFromUrl();
      resumeDispatchedRef.current = true;
      void resumeFromSession(urlSessionId);
      return;
    }

    // No URL param — check for orphaned-but-paid pending state.
    const pending = loadSearchPendingState();
    if (pending && pending.transactionId === transactionId && pending.sessionId) {
      // Agent CRM: a checkout waiting for the client survives a refresh, so a
      // second session is never opened behind it. Settled below if paid meanwhile.
      if (pending.onBehalfOf && pending.checkoutUrl) {
        setAssistedFor(pending.onBehalfOf);
        setHandoff({ side: pending.onBehalfOf, provider: pending.provider, sessionId: pending.sessionId, url: pending.checkoutUrl, totalPence: pending.totalPence });
        setHandoffSentTo(pending.linkSentTo ?? null);
      }
      resumeDispatchedRef.current = true;
      void resumeFromSession(pending.sessionId);
    }
  }, [settleVerifiedSession, transactionId]);

  /**
   * Resolved at order time as well as on mount (the lookup is cached), so a
   * click that lands before the mount lookup has can never bypass the hand-over.
   */
  async function assistedSide(): Promise<DealSide | null> {
    if (!transactionId) return null;
    const sides = await actingSidesFor(transactionId);
    const side = sides.includes(orderedBy) ? orderedBy : null;
    setAssistedFor(side);
    return side;
  }

  /** Assisted orders stop here: the payment is the client's, so the page is handed over or the link emailed. */
  function launchCheckout(side: DealSide | null, provider: SearchCheckoutProvider, sessionId: string, url: string, totalPence: number): void {
    if (side) {
      setHandoff({ side, provider, sessionId, url, totalPence });
      setHandoffSentTo(null);
      setHandoffError(null);
      setHandoffNote(null);
      setIsOrdering(null);
      return;
    }
    window.location.href = url;
  }

  async function emailPaymentLink(): Promise<void> {
    if (!handoff) return;
    setHandoffBusy('sending');
    setHandoffError(null);
    try {
      const res = await sendPaymentLink({ transactionId, role: handoff.side, sessionId: handoff.sessionId, propertyAddress: propertyAddress || postcode || 'your property' });
      const sent = res.sentTo || 'their inbox';
      setHandoffSentTo(sent);
      const stash = loadSearchPendingState();
      if (stash && stash.sessionId === handoff.sessionId) saveSearchPendingState({ ...stash, linkSentTo: sent });
    } catch (err) {
      setHandoffError(describePaymentLinkFailure(err));
      // An expired page cannot be resent: back to the builders for a fresh order.
      if (err instanceof DelegationError && err.code === 'session_not_open') {
        clearSearchPendingState();
        setHandoff(null);
      }
    } finally {
      setHandoffBusy(null);
    }
  }

  async function checkPayment(): Promise<void> {
    if (!handoff) return;
    setHandoffBusy('checking');
    setHandoffNote(null);
    try {
      const settled = await settleVerifiedSession(handoff.sessionId);
      if (!settled) setHandoffNote(NOT_PAID_YET);
    } catch (err) {
      setHandoffNote(isNotPaidYet(err) ? NOT_PAID_YET : CHECK_FAILED);
    } finally {
      setHandoffBusy(null);
    }
  }

  async function handleOneSearchOrder(searches: SearchItem[], estimatePence: number): Promise<void> {
    if (isOrdering) return;
    setIsOrdering('onesearch');
    setOneSearchError(null);

    // Send a WKT boundary: the property's own registered parcel when we can
    // resolve one from its UPRN, otherwise a box. Without any boundary,
    // onesearchService falls back to `{ landregPlan: true }`, which makes the
    // PISCES builder append a chargeable LANDREGPLAN line to every order —
    // a cost the pack RRPs don't cover. The fallback still applies when the
    // postcode has no grid reference, so ordering never hard-fails on it.
    const resolvedBoundary = await resolvePropertyBoundary({ uprn, postcode });
    if (!resolvedBoundary) {
      logger.warn('OneSearch order: postcode did not resolve to a boundary, falling back to LANDREGPLAN', { postcode });
    }

    // Price + persist a pending-payment order (Task 8) — nothing is sent to
    // OneSearch yet. The real PISCES POST happens server-side once Stripe
    // confirms payment (see onesearch-worker's confirm-payment route).
    const pending = await onesearchService.placeOrder({
      // Prefer the structured fields the List Property form captured. Parsing
      // the flattened string is a fallback for transactions that never stored
      // them, and it can only guess at what the form already knew.
      address: hasUsableStructuredAddress(addressParts)
        ? pafAddressFromParts(addressParts as StructuredAddress, laName)
        : parsePafAddress(propertyAddress, postcode, laName),
      ...(resolvedBoundary ? { boundary: { wkt: resolvedBoundary.wkt } } : {}),
      products: searches
        .filter((s) => Boolean(s.productType))
        .map((s) => ({ productType: s.productType as string })),
      clientReference: transactionId,
    });

    if (!pending.success || !pending.id) {
      logger.error('OneSearch order pricing/persist failed:', pending.error);
      failOneSearch(pending.error || 'OneSearch couldn’t price this order. Nothing has been charged.');
      return;
    }

    // The worker priced the order and stamped retail_gbp on the row;
    // payment-worker charges exactly that. Mirror it rather than the
    // client-side catalogue sum so what we display is what Stripe takes.
    // Mock mode returns a fixed synthetic price, so keep the catalogue
    // estimate there — the demo should show the pack the user picked.
    const totalPence = authoritativeTotalPence(
      pending.mock ? undefined : pending.retailGbp,
      estimatePence,
      'OneSearch',
    );

    if (totalPence === null) {
      failOneSearch(
        'OneSearch returned a price we can’t charge, so the order was stopped. Nothing has been charged — please try again shortly.',
      );
      return;
    }

    // Audit log to Supabase regardless of mock/real, so the transaction has
    // a record — unchanged from the previous flow.
    const auditResult = await searchOrderService.createOrder({
      transactionId,
      provider: 'onesearch',
      packageType: 'custom',
      // Nothing is owed in demo mode and the panel confirms on the spot, so
      // the audit row matches what the person is shown. A real order stays
      // 'requested' until Stripe says the money moved.
      status: pending.mock ? 'ordered' : 'requested',
      searches,
      // NOT exVatAmounts(): OneSearch retail is VAT-inclusive from 2026-08-20,
      // like tmGroup's. Groundsure below is still ex-VAT and keeps the zero.
      ...incVatAmounts(totalPence, pending.vatGbp),
      priority: false,
      priorityFeePence: 0,
      totalPence,
      orderedBy,
      postcode,
      localAuthority: laName || null,
    });
    if (!auditResult.success) {
      logger.warn('OneSearch DB insert failed (continuing anyway):', auditResult.error);
    }

    // Demo/mock mode (ONESEARCH_ENABLED off): placeOrder returns a synthetic
    // OS-MOCK row that doesn't exist worker-side, so a real Stripe checkout
    // against it would 404. Confirm immediately from the mock data instead —
    // this is what the pre-Task-9 code did unconditionally, and the app
    // needs to stay demoable with the flag off.
    if (pending.mock) {
      onProviderSelected?.(buildProviderSelection('onesearch', searches.length, totalPence));
      setIsOrdering(null);
      setOrderSummary({
        vatPence: incVatAmounts(totalPence, pending.vatGbp).vatPence,
        provider: PROVIDER_META.onesearch.label,
        searches,
        totalPence,
        ourReference: pending.ourReference,
        supplierReference: pending.supplierReference,
      });
      setPanelState('ordered');
      onOrderComplete?.();
      return;
    }

    // Redirect to Stripe. Control does not return after this in the happy
    // path — the user lands back on this page via success_url, and the
    // mount-time resume effect (above) picks up from there. Stash what the
    // resume effect needs to rebuild orderSummary — nothing survives the
    // redirect in memory.
    try {
      const side = await assistedSide();
      const principalId = await icpService.getUserPrincipal();
      const { sessionId, url } = await stripePaymentService.prepareSearchCheckoutSession({
        principalId,
        productRef: buildOneSearchProductRef(pending.id),
        // Stripe's back/cancel link returns here rather than /create-transaction.
        cancelPath: `${window.location.pathname}${window.location.search}`,
        ...(side ? { onBehalfOf: side, transactionId } : {}),
        ...(auditResult.orderId ? { searchOrderId: auditResult.orderId } : {}),
      });
      saveSearchPendingState({
        provider: 'onesearch',
        transactionId,
        searches,
        totalPence,
        // VAT-inclusive like tmGroup's, so the resumed row reports the VAT taken.
        vatPence: incVatAmounts(totalPence, pending.vatGbp).vatPence,
        ourReference: pending.ourReference,
        onBehalfOf: side ?? undefined,
        checkoutUrl: side ? url : undefined,
        sessionId,
        startedAt: new Date().toISOString(),
      });
      launchCheckout(side, 'onesearch', sessionId, url, totalPence);
    } catch (err) {
      logger.error('OneSearch checkout redirect failed:', err);
      setIsOrdering(null);
    }
  }

  /**
   * tmGroup order. Rebuilt 2026-08-14 on the shape the 2026-08-09 deletion
   * specified: server-side pricing from a Draft, stamped on a pending row, Stripe
   * charges that figure, and only then is the order placed.
   *
   * The version deleted in August took a CLIENT-SUPPLIED totalPence, charged it as
   * a committed payment, and placed no order with anybody. Nothing here computes a
   * price: `estimatePence` is only ever a log comparison, and the figure charged is
   * whatever tmgroup-worker stamped on the row.
   *
   * The one shape difference from the other two providers is the QUOTE. tmGroup
   * price per property, so the picker has already fetched a live Draft to show a
   * number. /order re-quotes server-side rather than trusting that, which is why
   * the price charged can differ from the price displayed -- `authoritativeTotalPence`
   * logs the divergence and the ROW wins, always.
   */
  async function handleTmGroupOrder(
    searches: SearchItem[],
    estimatePence: number,
  ): Promise<void> {
    if (isOrdering) return;
    setIsOrdering('tmgroup');
    setTmGroupError(null);

    const productCodes = searches
      .map((s) => s.productType)
      .filter((c): c is string => Boolean(c));

    if (!productCodes.length || !postcode) {
      // Neither is recoverable by retrying, and ordering with an empty basket or
      // no postcode is how an unpriceable order reaches a real supplier desk.
      logger.error('tmGroup order aborted: no product codes or no postcode');
      setIsOrdering(null);
      return;
    }

    const pending = await tmgroupService.placeOrder({
      productCodes,
      address: tmGroupAddressFromParts(addressParts, propertyAddress, postcode),
      transactionId,
    });

    if (!pending.success || !pending.id || typeof pending.retailPence !== 'number') {
      // An incomplete quote here means tmGroup could not price the basket for
      // this property. Retrying changes nothing, so stop rather than spin.
      logger.error('tmGroup order failed:', pending.error, pending.unpricedProductTypes);
      // Same wording as the quote-failure state on the card, from one helper —
      // the two were written twice and would have drifted apart.
      setTmGroupError(describeQuoteFailure(pending));
      setIsOrdering(null);
      return;
    }

    // A £0 charge must never reach Stripe. The worker guards this and so does the
    // picker; this is the last of the three, because a free order against searches
    // that cost £100-£300 is the single most expensive bug on this path.
    if (pending.retailPence <= 0) {
      logger.error('tmGroup returned a zero price for a placed row — refusing to charge', {
        id: pending.id,
      });
      setTmGroupError('We could not price searches for this property. Please check the address.');
      setIsOrdering(null);
      return;
    }

    // NOTE the /100. authoritativeTotalPence takes POUNDS because OneSearch and
    // Groundsure return retailGbp; tmGroup returns retailPence, so this call site
    // converts down and the helper immediately rounds back up. It is a round trip
    // through the same figure, and it is the only caller that does this — anyone
    // changing that helper's units must change this line with it.
    // Convert only when there IS a figure. `undefined / 100` is NaN, and
    // `typeof NaN === 'number'`, so dividing unconditionally would sail past
    // the "no figure at all" check and be reported as an unchargeable price
    // rather than falling back to the estimate.
    const retailGbp =
      pending.retailPence == null ? undefined : pending.retailPence / 100;
    const totalPence = authoritativeTotalPence(retailGbp, estimatePence, 'tmGroup');

    if (totalPence === null) {
      setTmGroupError(
        'tmGroup returned a price we can’t charge, so the order was stopped. Nothing has been charged — please try again shortly.',
      );
      setIsOrdering(null);
      return;
    }

    // NOT exVatAmounts(): that returns 0 VAT because Groundsure charges an ex-VAT
    // figure. tmGroup's retail is VAT-inclusive (as OneSearch's now is), so the
    // VAT we actually took is the worker's own vatPence and the subtotal is the
    // remainder.
    const vatPence = pending.vatPence ?? 0;
    const auditResult = await searchOrderService.createOrder({
      transactionId,
      provider: 'tmgroup',
      packageType: 'custom',
      searches,
      subtotalPence: totalPence - vatPence,
      vatPence,
      priority: false,
      priorityFeePence: 0,
      totalPence,
      orderedBy,
      postcode,
      localAuthority: laName || null,
    });
    if (!auditResult.success) {
      // Non-fatal for the same reason as OneSearch: the AUTHORITATIVE row already
      // exists in tmgroup_orders. This one is the transaction-flow display record.
      logger.warn('tmGroup audit insert failed (continuing anyway):', auditResult.error);
    }

    try {
      const side = await assistedSide();
      const principalId = await icpService.getUserPrincipal();
      const { sessionId, url } = await stripePaymentService.prepareSearchCheckoutSession({
        principalId,
        productRef: buildTmGroupProductRef(pending.id),
        cancelPath: `${window.location.pathname}${window.location.search}`,
        ...(side ? { onBehalfOf: side, transactionId } : {}),
        ...(auditResult.orderId ? { searchOrderId: auditResult.orderId } : {}),
      });
      saveSearchPendingState({
        provider: 'tmgroup',
        transactionId,
        searches,
        totalPence,
        // tmGroup's retail figure is VAT-inclusive, unlike the other two.
        vatPence: pending.vatPence,
        ourReference: pending.ourReference,
        onBehalfOf: side ?? undefined,
        checkoutUrl: side ? url : undefined,
        sessionId,
        startedAt: new Date().toISOString(),
      });
      launchCheckout(side, 'tmgroup', sessionId, url, totalPence);
    } catch (err) {
      logger.error('tmGroup checkout redirect failed:', err);
      setIsOrdering(null);
    }
  }

  /**
   * Groundsure instant order, same sequence as OneSearch: the worker prices
   * the basket against Groundsure's live pricing API and persists a
   * pending-payment row, Stripe charges that row's stamped price, and
   * groundsure-worker's /order/:id/confirm-payment places the real order
   * server-side once the webhook confirms. Nothing reaches Groundsure until
   * the money does.
   *
   * Every product in the curated residential catalogue has a fixed RRP at its
   * size tier, so there is no quote step — the pre-2026-07 quote-request flow
   * this replaces existed because the order path was never wired, not because
   * the prices were unknowable.
   */
  async function handleGroundsureOrder(
    searches: SearchItem[],
    estimatePence: number,
  ): Promise<void> {
    if (isOrdering) return;
    setIsOrdering('groundsure');
    setGroundsureError(null);
    setPendingDropped(null);

    // Every catalogue item has a code, but an unmapped id would otherwise be
    // silently dropped from the basket while still being charged for.
    const unmapped = searches.filter((s) => !groundsureCodeFor(s.id));
    if (unmapped.length > 0) {
      logger.error('Groundsure order: items have no product code, refusing to order', {
        ids: unmapped.map((s) => s.id),
      });
      failGroundsure(
        'Some of these searches can’t be ordered online yet. Remove them, or ask your conveyancer to order them directly.',
      );
      return;
    }

    const pending = await groundsureService.placeOrderForProperty({
      address: propertyAddress,
      postcode,
      uprn,
      items: searches.map((s) => ({ reportType: groundsureCodeFor(s.id) as string })),
      customerReference: transactionId,
    });

    if (!pending.success || !pending.id) {
      logger.error('Groundsure order pricing/persist failed:', pending.error);
      failGroundsure(pending.error || 'Groundsure couldn’t price this order. Nothing has been charged.');
      return;
    }

    const totalPence = authoritativeTotalPence(
      pending.mock ? undefined : pending.retailGbp,
      estimatePence,
      'Groundsure',
    );

    if (totalPence === null) {
      failGroundsure(
        'Groundsure returned a price we can’t charge, so the order was stopped. Nothing has been charged — please try again shortly.',
      );
      return;
    }

    // Groundsure declined one or more lines for this property. The total above
    // already excludes them, so nobody is overcharged -- but the customer
    // TICKED them, and quietly supplying less than was chosen is worse than
    // saying so. Stop here and wait for a second, informed click. Nothing is
    // persisted and no checkout is opened until then, so Cancel leaves no trace.
    if (!pending.mock && pending.dropped && pending.dropped.length > 0) {
      const droppedCodes = new Set(pending.dropped.map((d) => d.code));
      const kept = searches.filter((s) => !droppedCodes.has(groundsureCodeFor(s.id) as string));
      setPendingDropped({
        names: searches
          .filter((s) => droppedCodes.has(groundsureCodeFor(s.id) as string))
          .map((s) => s.name),
        pending,
        searches: kept,
        totalPence,
      });
      setIsOrdering(null);
      return;
    }

    await completeGroundsureOrder(pending, searches, totalPence);
  }

  /**
   * Everything after the price is agreed: the audit row, then Stripe.
   *
   * Split out of handleGroundsureOrder so the dropped-line confirmation can
   * re-enter it on the customer's second click without re-pricing -- re-pricing
   * would ask Groundsure again and could return a different basket than the one
   * just consented to.
   */
  async function completeGroundsureOrder(
    pending: Awaited<ReturnType<typeof groundsureService.placeOrderForProperty>>,
    searches: SearchItem[],
    totalPence: number,
  ): Promise<void> {
    if (!pending.id) return;

    const auditResult = await searchOrderService.createOrder({
      transactionId,
      provider: 'groundsure',
      packageType: 'custom',
      // Demo mode as above: nothing owed, confirmed on the spot.
      status: pending.mock ? 'ordered' : 'requested',
      searches,
      // Groundsure retail is VAT-inclusive from 2026-08-21, same as OneSearch and
      // tmGroup. All three suppliers now report a real split.
      ...incVatAmounts(totalPence, pending.vatGbp),
      priority: false,
      priorityFeePence: 0,
      totalPence,
      orderedBy,
      postcode,
      localAuthority: laName || null,
    });
    if (!auditResult.success) {
      logger.warn('Groundsure DB insert failed (continuing anyway):', auditResult.error);
    }

    // Demo/mock mode (GROUNDSURE_ENABLED off): the GS-MOCK row doesn't exist
    // worker-side, so a real Stripe checkout against it would 404. Confirm
    // from the mock data instead, same as OneSearch.
    if (pending.mock) {
      onProviderSelected?.(buildProviderSelection('groundsure', searches.length, totalPence));
      setIsOrdering(null);
      setOrderSummary({
        vatPence: incVatAmounts(totalPence, pending.vatGbp).vatPence,
        provider: PROVIDER_META.groundsure.label,
        searches,
        totalPence,
        ourReference: pending.ourReference,
      });
      setPanelState('ordered');
      onOrderComplete?.();
      return;
    }

    try {
      const side = await assistedSide();
      const principalId = await icpService.getUserPrincipal();
      const { sessionId, url } = await stripePaymentService.prepareSearchCheckoutSession({
        principalId,
        productRef: buildGroundsureProductRef(pending.id),
        cancelPath: `${window.location.pathname}${window.location.search}`,
        ...(side ? { onBehalfOf: side, transactionId } : {}),
        ...(auditResult.orderId ? { searchOrderId: auditResult.orderId } : {}),
      });
      saveSearchPendingState({
        provider: 'groundsure',
        transactionId,
        searches,
        totalPence,
        ourReference: pending.ourReference,
        onBehalfOf: side ?? undefined,
        checkoutUrl: side ? url : undefined,
        sessionId,
        startedAt: new Date().toISOString(),
      });
      launchCheckout(side, 'groundsure', sessionId, url, totalPence);
    } catch (err) {
      logger.error('Groundsure checkout redirect failed:', err);
      failGroundsure('Couldn’t open the payment page. Nothing has been charged — please try again.');
    }
  }

  // Costing request for the full-catalogue tick-box list — supplementary to
  // whichever pack/provider the buyer/seller orders above, so unlike the
  // other handlers this does NOT flip panelState to 'ordered' (that would
  // hide the pack pickers and Groundsure card entirely, which is wrong for
  // a handful of extra searches). OneSearchProductListCard shows its own
  // inline confirmation instead. Per OneSearch: tell them when someone picks
  // a product outside a pack and they sort the trade cost from there.
  //
  // Returns false on failure so the card can say so. Nothing here is
  // best-effort: these products have no price, so there is no paid order and
  // no PISCES call behind this — the row plus the email to OneSearch is the
  // entire mechanism. A silent failure would show the customer "request sent"
  // for a request that reached nobody.
  async function handleOneSearchProductsRequest(
    searches: SearchItem[],
    totalPence: number,
  ): Promise<boolean> {
    if (isOrdering) return false;
    setIsOrdering('onesearch-products');

    const subtotalPence = Math.round(totalPence / 1.2);
    const vatPence = totalPence - subtotalPence;

    try {
      const result = await searchOrderService.createOrder({
        transactionId,
        provider: 'onesearch',
        packageType: 'lineItem',
        searches,
        subtotalPence,
        vatPence,
        priority: false,
        priorityFeePence: 0,
        totalPence,
        orderedBy,
        postcode,
        localAuthority: laName || null,
      });

      if (!result.success || !result.orderId) {
        logger.error('OneSearch costing request could not be recorded:', result.error);
        return false;
      }

      const notified = await searchOrderService.notifyCostingRequest(result.orderId);
      if (!notified.success) {
        // The row survives with notified_at null, so the request is
        // recoverable from the DB rather than lost — but nobody at OneSearch
        // has been told yet, so the customer must not see "request sent".
        logger.error('OneSearch costing request recorded but not delivered:', {
          orderId: result.orderId,
          error: notified.error,
        });
        return false;
      }

      return true;
    } finally {
      setIsOrdering(null);
    }
  }

  if (panelState === 'loading') {
    return (
      <div className="space-y-6 p-1">
        <LoadingSkeleton />
      </div>
    );
  }

  if (panelState === 'error') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800/40 dark:bg-red-900/10">
        <p className="font-dm-sans text-sm font-medium text-red-700 dark:text-red-400">
          Could not look up postcode information.
        </p>
        <button
          type="button"
          onClick={() => {
            setPanelState('loading');
          }}
          className="mt-3 text-sm font-medium text-[#0D9488] underline hover:text-[#0F766E] dark:text-[#14B8A6]"
        >
          Retry
        </button>
      </div>
    );
  }

  if (panelState === 'ordered' && orderSummary) {
    const handleEdit = onEdit
      ? (): void => {
          onEdit();
          // Reset local panel state so the order form renders again. The
          // parent's onEdit (clearProvider) handles the chain side.
          setOrderSummary(null);
          setPanelState('ready');
        }
      : undefined;
    return (
      <div className="space-y-4">
        <OrderConfirmation
          summary={orderSummary}
          postcode={postcode}
          laName={laName}
          onEdit={handleEdit}
        />
        <SharedSearchPoolCallout />
      </div>
    );
  }

  // Agent CRM: a checkout waiting for the client takes the panel over, so a
  // second order cannot be set up behind it. "Choose a different order"
  // abandons the unpaid session and shows the builders again.
  if (handoff) {
    return (
      <div className="space-y-4">
        <PaymentHandoffCard
          side={handoff.side}
          providerLabel={PROVIDER_META[handoff.provider].label}
          totalPence={handoff.totalPence}
          sentTo={handoffSentTo}
          busy={handoffBusy}
          error={handoffError}
          note={handoffNote}
          onHandOver={() => {
            window.location.href = handoff.url;
          }}
          onEmailLink={() => void emailPaymentLink()}
          onCheckPayment={() => void checkPayment()}
        />
        {/* Once the link is in the client's inbox they may pay it, so the agent stays here to settle it. */}
        {!handoffSentTo && (
          <button
            type="button"
            disabled={handoffBusy !== null}
            onClick={() => {
              clearSearchPendingState();
              setHandoff(null);
            }}
            className="font-dm-sans text-sm text-gray-600 underline-offset-2 hover:underline disabled:opacity-60 dark:text-gray-400"
          >
            Choose a different order instead
          </button>
        )}
      </div>
    );
  }

  // ready state
  const formattedPostcode = postcode ? postcodeService.formatPostcode(postcode) : '';
  // Grossed up because the card stamps "inc VAT" under this figure, and the
  // Groundsure rate card is the one provider list held ex-VAT. OneSearch's
  // standardPackPence is already VAT-inclusive, so it is passed through as-is.
  const cheapestGroundsureBundle = grossPence(
    groundsureBundles.reduce(
      (min, b) => (b.pricePence < min ? b.pricePence : min),
      Number.POSITIVE_INFINITY,
    ),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-fraunces text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Property Searches
          </h2>
          <p className="mt-1 font-dm-sans text-sm text-gray-500 dark:text-gray-400">
            Searches for{' '}
            <span className="font-geist-mono tabular-nums text-gray-700 dark:text-gray-300">
              {formattedPostcode}
            </span>
            {laName && (
              <>
                {' '}
                &middot;{' '}
                <span className="text-gray-700 dark:text-gray-300">{laName}</span>
              </>
            )}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#84A98C]/15 px-3 py-1 text-xs font-medium text-[#5F8A68] dark:bg-[#9CB8A4]/10 dark:text-[#9CB8A4]">
          CoPSO
        </span>
      </div>

      {assistedFor && handoffError && (
        <p role="alert" className="font-dm-sans text-sm text-[#9A3412] dark:text-[#FDBA74]">
          {handoffError}
        </p>
      )}
      {assistedFor && (
        <p data-testid="assisted-note" className="rounded-lg border border-[#0D9488]/30 bg-[#CCFBF1]/20 px-4 py-3 font-dm-sans text-sm text-[#0F766E]">
          Ordering in the {assistedFor}&rsquo;s name. The payment is theirs: once the order is set up you can hand the screen over or
          email them the link.
        </p>
      )}
      {explainerModel && (
        <>
          <ExplainerModal
            storageKey="searches"
            transactionId={transactionId}
            title="Before you order"
            dismissLabel="Got it, show me the options"
          >
            <SearchesExplainerContent
              model={explainerModel}
              localAuthorityName={laName}
              narration={narration ?? undefined}
            />
          </ExplainerModal>
          <ExplainerCard
            label="What these searches are &amp; why"
            headline={`${explainerModel.required.length} typically ordered here${
              explainerModel.notNeeded.length > 0
                ? ` · ${explainerModel.notNeeded.length} not usually needed`
                : ''
            }`}
          >
            <SearchesExplainerContent
              model={explainerModel}
              localAuthorityName={laName}
              narration={narration ?? undefined}
            />
          </ExplainerCard>
        </>
      )}

      {/* OneSearch — recommended, collapsed by default like the others */}
      <SearchAreaNote source={areaSource} halfSizeMetres={areaHalfSize} />

      <CollapsibleProviderCard
        logo={onesearchProvider.logo}
        name={onesearchProvider.name}
        tagline={onesearchProvider.tagline}
        turnaround={onesearchProvider.turnaround}
        fromPricePence={onesearchProvider.standardPackPence}
        badge="Recommended"
        highlighted
      >
        <div className="space-y-4">
          <OneSearchPackageBuilder
            postcode={formattedPostcode}
            localAuthority={laName}
            areaRequiredIds={areaRequiredItemIds}
            onOrder={handleOneSearchOrder}
            isOrdering={isOrdering === 'onesearch'}
            errorMessage={oneSearchError}
          />
          <OneSearchProductListCard
            areaCapabilities={areaCapabilities}
            onRequest={handleOneSearchProductsRequest}
            isRequesting={isOrdering === 'onesearch-products'}
          />
        </div>
      </CollapsibleProviderCard>

      {/* tmGroup — collapsed */}
      <CollapsibleProviderCard
        logo={tmGroupProvider.logo}
        name={tmGroupProvider.name}
        tagline={tmGroupProvider.tagline}
        turnaround={tmGroupProvider.turnaround}
        fromPricePence={tmGroupProvider.standardPackPence}
      >
        <SearchPackageBuilder
          postcode={formattedPostcode}
          localAuthority={laName}
          addressParts={addressParts}
          propertyAddress={propertyAddress}
          onOrder={handleTmGroupOrder}
          isOrdering={isOrdering === 'tmgroup'}
          errorMessage={tmGroupError}
        />
      </CollapsibleProviderCard>

      {/* Groundsure — PropXchain-branded, collapsed */}
      <CollapsibleProviderCard
        logo="GS"
        name="Groundsure"
        tagline="Bundles and singles at RRP, ordered via PropXchain"
        turnaround="24-48 hrs"
        fromPricePence={cheapestGroundsureBundle}
        propxchainBranded
      >
        <GroundsureBundlePicker
          postcode={formattedPostcode}
          areaCapabilities={areaCapabilities}
          onOrder={handleGroundsureOrder}
          isOrdering={isOrdering === 'groundsure'}
          errorMessage={groundsureError}
          notice={
            pendingDropped && (
              <DroppedSearchesNotice
                names={pendingDropped.names}
                totalPence={pendingDropped.totalPence}
                remainingCount={pendingDropped.searches.length}
                isBusy={isOrdering === 'groundsure'}
                onCancel={() => setPendingDropped(null)}
                onContinue={() => {
                  const confirmed = pendingDropped;
                  setPendingDropped(null);
                  setIsOrdering('groundsure');
                  void completeGroundsureOrder(
                    confirmed.pending,
                    confirmed.searches,
                    confirmed.totalPence,
                  );
                }}
              />
            )
          }
        />
      </CollapsibleProviderCard>

      {/* Shared Search Pool callout */}
      <SharedSearchPoolCallout />
    </div>
  );
}
