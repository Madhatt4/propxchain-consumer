/**
 * Helpers for the search-order Stripe-checkout resume flow, split out from
 * SearchesPanel.tsx so the URL-param/productRef logic is testable without
 * rendering the panel, and so PaymentSuccessPage.tsx (a different route,
 * mounted after the Stripe redirect) can read the same pending-order stash
 * SearchesPanel wrote before redirecting — the two never share a component
 * tree, only this module and localStorage. Mirrors
 * HMLRTitlePullButton.tsx's readStripeSessionIdFromUrl / pending-state
 * pattern, generalised to a shared module since it now has two consumers.
 */

import type { SearchItem } from './searchProviderData';
import type { DealSide } from './shareParty.service';

export const SEARCH_STRIPE_SESSION_PARAM = 'search_stripe_session_id';

// Key kept at the original onesearch-specific string deliberately: renaming it
// would orphan any checkout already in flight at deploy time (the stash is
// written before the Stripe redirect and read after it, so a rename loses the
// order for anyone mid-payment). One stash serves both providers — only one
// search checkout can be in flight at a time.
const SEARCH_PENDING_KEY = 'propxchain.onesearch.pending';
// Pending state older than this is treated as abandoned and cleared, same
// TTL rationale as HMLR's pending-pull state.
const PENDING_STATE_TTL_MS = 24 * 60 * 60 * 1000;

/** Which supplier the in-flight checkout belongs to — drives how the resume rebuilds its summary. */
export type SearchCheckoutProvider = 'onesearch' | 'groundsure' | 'tmgroup';

export interface SearchPendingState {
  provider: SearchCheckoutProvider;
  transactionId: string;
  searches: SearchItem[];
  /**
   * The amount Stripe will actually charge, in pence — taken from the
   * supplier worker's `retailGbp`, never from a client-side catalogue sum.
   * payment-worker prices the session off the persisted order row, so this
   * is a mirror of the authoritative figure, not an input to it.
   */
  totalPence: number;
  /**
   * VAT inside totalPence, in pence. Present for tmGroup and, from 2026-08-20,
   * OneSearch — both stamp a VAT-INCLUSIVE retail figure on the order row, so
   * reporting 0 would understate the VAT we actually took. tmGroup's is a service
   * uplift + VAT on our own sale price + disbursement at cost; OneSearch's is 20%
   * on the net rate card.
   *
   * Absent for Groundsure, which still stamps an ex-VAT RRP that payment-worker
   * charges unchanged. That is a known gap rather than a settled position — see
   * the exVatAmounts comment in SearchesPanel.
   */
  vatPence?: number;
  ourReference?: string;
  /**
   * Stripe Checkout Session id, stashed alongside the rest so a
   * param-less mount (user closed the tab during checkout, or paid on
   * another device and came back to this one directly) can still verify
   * and resume — mirrors HMLRTitlePullButton's orphan-recovery path.
   */
  sessionId: string;
  /** Agent CRM (spec I3): the side the order was paid for when an agency member set it up. */
  onBehalfOf?: DealSide;
  /** Stripe's page for an assisted order, so the waiting hand-over survives a refresh. */
  checkoutUrl?: string;
  /** Where the payment link was emailed, once it has been. */
  linkSentTo?: string;
  startedAt: string;
}

export function buildGroundsureProductRef(orderId: string): string {
  return `groundsure:${orderId}`;
}

export function buildOneSearchProductRef(orderId: string): string {
  return `onesearch:${orderId}`;
}

export function buildTmGroupProductRef(orderId: string): string {
  return `tmgroup:${orderId}`;
}

export function readPendingSearchCheckoutFromUrl(url: URL): string | null {
  return url.searchParams.get(SEARCH_STRIPE_SESSION_PARAM);
}

export function saveSearchPendingState(state: SearchPendingState): void {
  localStorage.setItem(SEARCH_PENDING_KEY, JSON.stringify(state));
}

export function loadSearchPendingState(): SearchPendingState | null {
  const raw = localStorage.getItem(SEARCH_PENDING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SearchPendingState;
    const startedAtMs = Date.parse(parsed.startedAt);
    if (Number.isNaN(startedAtMs) || Date.now() - startedAtMs > PENDING_STATE_TTL_MS) {
      localStorage.removeItem(SEARCH_PENDING_KEY);
      return null;
    }
    // Stash written before `provider` existed (a checkout in flight across the
    // deploy that added Groundsure) can only have been a OneSearch one.
    return { ...parsed, provider: parsed.provider ?? 'onesearch' };
  } catch {
    localStorage.removeItem(SEARCH_PENDING_KEY);
    return null;
  }
}

export function clearSearchPendingState(): void {
  localStorage.removeItem(SEARCH_PENDING_KEY);
}
