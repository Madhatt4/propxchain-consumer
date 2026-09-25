/**
 * Stripe Payment Service
 * Handles Stripe Checkout integration via Cloudflare Worker
 */

import { logger } from '@/utils/logger';
import { supabase } from '@/lib/supabase';
import type { DealSide } from './shareParty.service';

const WORKER_URL = import.meta.env.VITE_PAYMENT_WORKER_URL;
if (!WORKER_URL && import.meta.env.PROD) {
  throw new Error('VITE_PAYMENT_WORKER_URL is required in production');
}

/**
 * Read the current Supabase access token. The payment worker (audit #47)
 * requires a Supabase JWT on /create-session and /verify-session. Throws
 * if no session is present so the caller surfaces "sign in to pay" rather
 * than letting the worker return a generic 401.
 */
async function getSupabaseJwt(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`Could not read Supabase session: ${error.message}`);
  }
  const token = data?.session?.access_token;
  if (!token) {
    throw new Error('You must be signed in to start a paid transaction.');
  }
  return token;
}

/**
 * Where Stripe's back/cancel link should return the user: wherever they were
 * when they started paying.
 *
 * payment-worker defaults an absent `cancelPath` to `/create-transaction`,
 * which is how cancelling a chain-unlock or an HMLR title pull dumped the user
 * on "start a transaction" instead of the transaction they were working on.
 * The worker cannot know the page, so the default belongs here. Callers may
 * still pass an explicit cancelPath to override.
 *
 * Applied to caller-supplied paths as well as the default, so there is exactly
 * one rule and no caller can post a path the worker will reject. Mirrors
 * payment-worker's own validation byte for byte (single leading '/', no '//'
 * protocol-relative, no backslashes, <= 512 chars) -- the path ends up inside
 * Stripe's cancel_url, so an off-origin value must never reach it. Returning
 * undefined leaves the worker's own fallback as the last line of defence.
 */
function safeCancelPath(candidate?: string): string | undefined {
  const path =
    candidate ??
    (typeof window === 'undefined'
      ? undefined
      : `${window.location.pathname}${window.location.search}`);
  if (!path || path.length > 512) return undefined;
  return /^\/(?!\/)[^\\]*$/.test(path) ? path : undefined;
}

export interface CreateSessionParams {
  principalId: string;
  tier: string;
  amount: number; // GBP (e.g., 75)
  /** Same-origin path Stripe's back/cancel link returns to. Defaults to the current page. */
  cancelPath?: string;
}

export interface SearchCheckoutParams {
  principalId: string;
  productRef: string; // "groundsure:<orderId>" | "onesearch:<orderId>" | "aml:<orderId>"
  /** Checkout category the worker prices against. Defaults to 'search' — every
   * existing caller (Groundsure/OneSearch) relies on that default. */
  type?: string;
  /** Same-origin path Stripe's back/cancel link returns to (e.g. the transaction flow page). */
  cancelPath?: string;
  /** Agent CRM (spec I3): bill the client the caller acts for on this deal. The worker checks the mandate and that the order belongs to the deal. */
  onBehalfOf?: DealSide;
  transactionId?: string;
  /** The deal's `search_orders` audit row, promoted from 'requested' to 'ordered' by the worker once Stripe confirms payment. */
  searchOrderId?: string;
}

export interface ChainUnlockCheckoutParams {
  principalId: string;
  transactionId: string;
  /** Same-origin path Stripe's back/cancel link returns to. Defaults to the current page. */
  cancelPath?: string;
}

export interface VerifySessionResult {
  verified: boolean;
  principalId: string;
  tier: string;
  amountPaid: number; // Pence (e.g., 7500)
  sessionId: string;
  // Present on search-order checkouts (type: 'search' posted to /create-session
  // by prepareSearchCheckoutSession); absent/undefined on premium-tier and
  // HMLR-pull sessions, which are distinguished via `tier` instead.
  type?: string;
  /** The search provider a search-order session was priced against. */
  provider?: string | null;
  /** Agent CRM: whose name a search order was paid in; null or absent for a party's own order. */
  onBehalfOf?: DealSide | null;
  payerUserSub?: string | null;
  transactionId?: string | null;
}

class StripePaymentService {
  /**
   * Validate that a Stripe Checkout redirect URL points at a trusted
   * Stripe host, guarding against a compromised/misconfigured worker
   * redirecting the browser off-domain.
   */
  private assertTrustedStripeRedirect(url: string): void {
    try {
      const parsedUrl = new URL(url);
      const trustedHosts = ['checkout.stripe.com', 'pay.stripe.com'];
      if (!trustedHosts.includes(parsedUrl.hostname)) {
        throw new Error(`Untrusted payment redirect: ${parsedUrl.hostname}`);
      }
    } catch (urlError) {
      logger.error('Invalid Stripe redirect URL');
      throw new Error('Invalid payment redirect URL');
    }
  }

  /**
   * Create a Stripe Checkout session and redirect to payment
   */
  async createCheckoutSession(params: CreateSessionParams): Promise<void> {
    const { sessionId, url } = await this.prepareCheckoutSession(params);
    void sessionId; // unused by the fire-and-forget variant
    window.location.href = url;
  }

  /**
   * Create a Stripe Checkout session and return the sessionId + url
   * WITHOUT redirecting. Lets the caller stash the sessionId before
   * navigating away (used by flows that need to resume after the
   * Stripe round-trip, e.g. HMLR title pulls).
   */
  async prepareCheckoutSession(
    params: CreateSessionParams,
  ): Promise<{ sessionId: string; url: string }> {
    try {
      const token = await getSupabaseJwt();
      const response = await fetch(`${WORKER_URL}/create-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...params,
          cancelPath: safeCancelPath(params.cancelPath),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      const { url, sessionId } = await response.json();

      if (!sessionId) {
        throw new Error('Worker did not return a sessionId');
      }

      this.assertTrustedStripeRedirect(url);

      logger.info('Stripe session prepared', { sessionId });
      return { sessionId, url };
    } catch (error) {
      logger.error('Error preparing checkout session:', error);
      throw error;
    }
  }

  /**
   * Create a Stripe Checkout session for a search order (Groundsure/
   * OneSearch), without redirecting — mirrors prepareCheckoutSession's
   * "capture sessionId before navigating" shape so callers can stash it for
   * resume-after-redirect, same pattern HMLRTitlePullButton already uses.
   */
  async prepareSearchCheckoutSession(
    params: SearchCheckoutParams,
  ): Promise<{ sessionId: string; url: string }> {
    try {
      const token = await getSupabaseJwt();
      const response = await fetch(`${WORKER_URL}/create-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          principalId: params.principalId,
          type: params.type ?? 'search',
          productRef: params.productRef,
          cancelPath: safeCancelPath(params.cancelPath),
          ...(params.onBehalfOf ? { onBehalfOf: params.onBehalfOf, transactionId: params.transactionId } : {}),
          ...(params.searchOrderId ? { searchOrderId: params.searchOrderId } : {}),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      const { url, sessionId } = await response.json();
      if (!sessionId) {
        throw new Error('Worker did not return a sessionId');
      }

      this.assertTrustedStripeRedirect(url);

      logger.info('Search checkout session prepared', { sessionId });
      return { sessionId, url };
    } catch (error) {
      logger.error('Error preparing search checkout session:', error);
      throw error;
    }
  }

  /**
   * One-off £25 VMC chain-unlock checkout. Server derives price + productRef
   * from the transactionId. Mirrors prepareSearchCheckoutSession's
   * capture-sessionId-before-redirect shape.
   */
  async prepareChainUnlockCheckoutSession(
    params: ChainUnlockCheckoutParams,
  ): Promise<{ sessionId: string; url: string }> {
    try {
      const token = await getSupabaseJwt();
      const response = await fetch(`${WORKER_URL}/create-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          principalId: params.principalId,
          type: 'chain-unlock',
          transactionId: params.transactionId,
          cancelPath: safeCancelPath(params.cancelPath),
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }
      const { url, sessionId } = await response.json();
      if (!sessionId) throw new Error('Worker did not return a sessionId');
      this.assertTrustedStripeRedirect(url);
      logger.info('Chain-unlock checkout session prepared', { sessionId });
      return { sessionId, url };
    } catch (error) {
      logger.error('Error preparing chain-unlock checkout session:', error);
      throw error;
    }
  }

  /**
   * Verify a completed Stripe session
   */
  async verifySession(sessionId: string): Promise<VerifySessionResult> {
    try {
      const token = await getSupabaseJwt();
      const response = await fetch(`${WORKER_URL}/verify-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to verify session');
      }

      const result = await response.json();
      logger.info('✅ Payment verified:', result);
      return result;
    } catch (error) {
      logger.error('Error verifying session:', error);
      throw error;
    }
  }
}

export const stripePaymentService = new StripePaymentService();
export default stripePaymentService;
