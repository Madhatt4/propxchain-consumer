// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Client for the tmGroup (tmConnect) Cloudflare Worker.
 *
 * tmGroup differ from OneSearch and Groundsure in one way that shapes this whole
 * file: THEY QUOTE PER PROPERTY. Local Authority fees run £100-£300 by council
 * and water £17-£98 (tmGroup, 2026-07-23), so there is no rate card and the
 * catalogue in searchProviderData carries 0 for every line. The price only exists
 * once a real tmGroup Draft comes back for a real address.
 *
 * That is why this service has a getQuote() the other two do not need, and why
 * the picker MUST call it before it can show a number or an order button.
 *
 * Worker contract:
 *   POST /quote  → { productCodes, address }
 *                  returns live per-property pricing from a Draft, plus
 *                  failedProductTypes / unpricedProductTypes / isComplete
 *   POST /order  → same body; prices server-side, persists a pending-payment
 *                  row, places NOTHING. Returns { id, ourReference, retailPence }
 *
 * The client never sends a price. payment-worker re-derives it from the row.
 *
 * A £0 QUOTE IS NOT A FREE ORDER. tmGroup answer 200 with every line at £0.00
 * and an EMPTY failure list when they cannot resolve a property's authorities
 * (demo20, 2026-08-10, a Scottish UPRN). `unpricedProductTypes` is the only
 * signal that distinguishes it, and callers must refuse to order on it.
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';

import { FEATURE_FLAGS } from '../config/features';
import {
  hasUsableStructuredAddress,
  pafAddressFromParts,
  parsePafAddress,
  type StructuredAddress,
} from './pafAddress';

/**
 * Read lazily rather than into a module-level const (which is what the other two
 * services do). A const is captured at import time and cannot be stubbed, which
 * left every network path here untestable — and this is the money path, so
 * "untestable" is not a trade worth making for consistency.
 */
function workerUrl(): string {
  return import.meta.env.VITE_TMGROUP_WORKER_URL || '';
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** tmGroup's PAF-shaped address. Note lower-case `postcode` — their schema uses it. */
export interface TmGroupAddress {
  organisation?: string;
  subBuildingName?: string;
  buildingName?: string;
  buildingNumber?: string;
  thoroughfareName?: string;
  dependantLocality?: string;
  postTown?: string;
  county?: string;
  postcode: string;
}

export interface TmGroupQuoteLine {
  productType: string;
  vatablePence: number;
  nonVatablePence: number;
  vatPence: number;
  grossPence: number;
  turnaroundWorkingDays: number | null;
}

export interface TmGroupQuote {
  success: boolean;
  projectId?: string;
  draftId?: string;
  lines?: TmGroupQuoteLine[];
  netPence?: number;
  vatPence?: number;
  grossPence?: number;
  disbursementPence?: number;
  failedProductTypes?: string[];
  failedReasons?: string[];
  /** £0 with a null turnaround: tmGroup could not resolve this property's authorities. */
  unpricedProductTypes?: string[];
  isComplete?: boolean;
  mock?: boolean;
  error?: string;
  /** Human-readable refusal, e.g. the England-and-Wales coverage message. */
  message?: string;
}

export interface TmGroupOrder {
  success: boolean;
  id?: string;
  ourReference?: string;
  /** Inc VAT, what Stripe will charge. */
  retailPence?: number;
  netPence?: number;
  vatPence?: number;
  disbursementPence?: number;
  status?: string;
  mock?: boolean;
  error?: string;
  message?: string;
  unpricedProductTypes?: string[];
}

interface QuoteInput {
  productCodes: string[];
  address: TmGroupAddress;
  transactionId?: string;
  projectReference?: string;
}

/**
 * Off-switch. Unlike the other two services this does NOT fabricate a plausible
 * mock price: a made-up tmGroup number is precisely the bug that was deleted on
 * 2026-08-09 (a client-supplied total charged for an order nobody placed). When
 * tmGroup is off, callers get an explicit failure and show no price at all.
 */
function disabled(): { success: false; error: string } {
  return { success: false, error: 'tmgroup_disabled' };
}

function isEnabled(): boolean {
  return FEATURE_FLAGS.TMGROUP_ENABLED && Boolean(workerUrl());
}

async function post(path: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const resp = await fetch(`${workerUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body),
  });
  return { ok: resp.ok, data: (await resp.json()) as Record<string, unknown> };
}

/** POST /quote — live per-property pricing from a real tmGroup Draft. Places nothing. */
async function getQuote(input: QuoteInput): Promise<TmGroupQuote> {
  if (!isEnabled()) return disabled();
  if (!input.productCodes.length) return { success: false, error: 'no_products_selected' };
  if (!input.address?.postcode) return { success: false, error: 'missing_postcode' };

  try {
    const { ok, data } = await post('/quote', {
      productCodes: input.productCodes,
      address: input.address,
      transactionId: input.transactionId,
      projectReference: input.projectReference,
    });

    if (!ok) {
      // The jurisdiction refusal carries a message meant for a person. Passing
      // only the code would leave the picker with nothing to show them.
      return {
        success: false,
        error: (data.error as string) || 'quote_failed',
        message: data.message as string | undefined,
      };
    }

    return { success: true, ...(data as Omit<TmGroupQuote, 'success'>) };
  } catch (err) {
    logger.error('tmGroup getQuote error:', err);
    return { success: false, error: 'Network error' };
  }
}

/**
 * POST /order — prices server-side and persists a pending-payment row.
 * Places NOTHING with tmGroup; that happens after Stripe confirms.
 */
async function placeOrder(input: QuoteInput): Promise<TmGroupOrder> {
  if (!isEnabled()) return disabled();

  try {
    const { ok, data } = await post('/order', {
      productCodes: input.productCodes,
      address: input.address,
      transactionId: input.transactionId,
      projectReference: input.projectReference,
    });

    if (!ok) {
      // Log the WHOLE body. On 2026-08-16 an order failed with
      // `tmconnect_api_error` and the console showed only that; tmGroup's actual
      // reason ("Project Reference must be 50 characters or fewer") was sitting
      // in the upstream body, which this function used to drop on the floor.
      // Diagnosing it took a direct probe against demo20 that should have been
      // unnecessary.
      logger.error('tmGroup placeOrder failed', data);
      return {
        success: false,
        error: (data.error as string) || 'Order failed',
        message: data.message as string | undefined,
        // 422 incomplete_quote carries this; it is the difference between
        // "deselect a product" and "we cannot serve this address".
        unpricedProductTypes: data.unpricedProductTypes as string[] | undefined,
      };
    }

    return {
      success: true,
      id: data.id as string,
      ourReference: data.ourReference as string,
      retailPence: data.retailPence as number,
      netPence: data.netPence as number,
      vatPence: data.vatPence as number,
      disbursementPence: data.disbursementPence as number,
      status: data.status as string,
    };
  } catch (err) {
    logger.error('tmGroup placeOrder error:', err);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Is this quote safe to put an order button against?
 *
 * Belt and braces over the worker's own guard. A quote that is not complete, or
 * that priced anything at nothing, must never reach a checkout: £0 through
 * Stripe is a free order against searches that cost us £100-£300.
 */
export function isQuoteOrderable(quote: TmGroupQuote): boolean {
  return (
    quote.success === true &&
    quote.isComplete === true &&
    (quote.unpricedProductTypes?.length ?? 0) === 0 &&
    (quote.failedProductTypes?.length ?? 0) === 0 &&
    typeof quote.grossPence === 'number' &&
    quote.grossPence > 0
  );
}

/**
 * Build tmGroup's address from whatever the listing gave us.
 *
 * Reuses the PAF helpers the OneSearch path already proves rather than parsing
 * addresses a second way — two address parsers drifting apart is how a property
 * gets ordered against the wrong council.
 *
 * tmGroup read `postcode ?? postCode`, so the PAF shape passes through as-is; we
 * add lower-case `postcode` because their schema names it that and the worker's
 * jurisdiction guard reads it first.
 */
export function tmGroupAddressFromParts(
  parts: StructuredAddress | null | undefined,
  fallbackAddress: string,
  postcode: string,
  localAuthority?: string,
): TmGroupAddress {
  const paf = hasUsableStructuredAddress(parts)
    ? pafAddressFromParts(parts as StructuredAddress, localAuthority ?? '')
    : parsePafAddress(fallbackAddress, postcode, localAuthority ?? '');

  return { ...paf, postcode: paf.postCode || postcode };
}

export const tmgroupService = {
  getQuote,
  placeOrder,
  isQuoteOrderable,
  isEnabled,
};
