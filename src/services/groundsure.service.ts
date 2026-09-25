// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Client for the Groundsure searches Cloudflare Worker (`propxchain-groundsure`).
 * The worker proxies Groundsure's reseller report API and persists order state
 * in Supabase (`public.groundsure_orders`). The authoritative protocol contract
 * lives in `packages/groundsure-rest` + `groundsure-worker/` in the monorepo.
 *
 * Worker contract (every route below requires a Supabase user JWT):
 *   POST /order                 → { address, wkt, items: [{ reportType, reference?, metadata? }],
 *                                   customerReference?, postcode? }
 *                                 → { id, ourReference, retailGbp, netGbp, vatGbp, dropped, orderedCodes, status: 'pending_payment' }
 *                                   (prices + persists a row; the real order is placed once
 *                                   stripe-webhook confirms payment via /order/:id/confirm-payment)
 *   GET  /order/:ourReference   → { status, jsonSummary, documents, ... } (self-completes on read)
 *
 * Order codes (`reportType`) come from `groundsureProductCodes` in
 * searchProviderData.ts — map a panel SearchItem.id with `groundsureCodeFor()`.
 *
 * Completed reports are also pushed by Groundsure to the worker's
 * /webhook/delivery; to read results, query Supabase, not this service.
 */

import { FEATURE_FLAGS } from '../config/features';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { resolvePropertyBoundary } from './inspireBoundary.service';

const WORKER_URL = import.meta.env.VITE_GROUNDSURE_WORKER_URL || '';

// ─── Request / response types (mirror the worker contract) ───────────────

export interface GroundsureOrderItem {
  /** Groundsure report_type, e.g. 'homebuyers' (see groundsureProductCodes). */
  reportType: string;
  /** Optional per-item reference; the worker generates one if omitted. */
  reference?: string;
  metadata?: Record<string, unknown>;
}

export interface PlaceOrderInput {
  /** Free-text property address. */
  address: string;
  /** WKT polygon (EPSG:27700) describing the site boundary. */
  wkt: string;
  items: GroundsureOrderItem[];
  /** Correlation id we set; echoed back on the delivery webhook. */
  customerReference?: string;
  postcode?: string;
  thirdPartyReference?: string;
}

/**
 * Postcode-driven order input. Callers pass a postcode and we resolve the WKT
 * site boundary internally (see propertyBoundary.service) — they don't need to
 * know about British National Grid coordinates or polygons.
 */
export interface PlaceOrderForPropertyInput {
  /** Free-text property address. */
  address: string;
  /**
   * UPRN from the EPC register, when the listing captured one. Supplying it
   * upgrades the site boundary from a box to the property's own registered
   * freehold parcel; omitting it is safe and keeps today's behaviour.
   */
  uprn?: string | null;
  /** Property postcode — the fallback when there is no UPRN or no parcel for it. */
  postcode: string;
  items: GroundsureOrderItem[];
  /** Correlation id we set; echoed back on the delivery webhook. */
  customerReference?: string;
  thirdPartyReference?: string;
  /** Override the fallback box half-size in metres (default 35, a 70m square). */
  halfSizeMetres?: number;
}

/** A line Groundsure would not price for this site, and its own reason why. */
export interface DroppedLine {
  /** Groundsure product code, e.g. `cheshire_salt`. */
  code: string;
  /** Groundsure's `invalid_reason`, or `not_returned` when it omitted the line. */
  reason: string;
}

interface OrderResult {
  success: boolean;
  id?: string;
  ourReference?: string;
  groundsureOrderId?: string;
  /** GROSS, VAT-inclusive — the figure Stripe charges. Do not add VAT again. */
  retailGbp?: number;
  /** Summed Groundsure RRP, ex-VAT. */
  netGbp?: number;
  /** Output VAT contained within retailGbp. */
  vatGbp?: number;
  /**
   * Lines the worker excluded because Groundsure declined to price them for
   * this property — a regional search off its patch, or an outline outside
   * every price band. Already excluded from every figure above, so the caller
   * is not overcharged; but the customer CHOSE these, so the caller must show
   * them before taking payment rather than silently supplying less.
   */
  dropped?: DroppedLine[];
  /** The codes actually priced, in request order. Pairs with `dropped`. */
  orderedCodes?: string[];
  status?: string;
  mock?: boolean;
  error?: string;
}

interface OrderStatusResult {
  success: boolean;
  status?: string;
  jsonSummary?: unknown;
  documents?: unknown;
  mock?: boolean;
  error?: string;
}

// ─── Auth ────────────────────────────────────────────────────────────────

/** Authorization header carrying the current Supabase access token (worker requires it). */
async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function disabled(): boolean {
  return !FEATURE_FLAGS.GROUNDSURE_ENABLED || !WORKER_URL;
}

// ─── Methods ───────────────────────────────────────────────────────────────

/** POST /order — price + persist a pending-payment Groundsure order (not yet placed). */
async function placeOrder(input: PlaceOrderInput): Promise<OrderResult> {
  if (disabled()) {
    return {
      success: true,
      id: 'GS-MOCK-ROW-ID',
      ourReference: 'GS-MOCK-001',
      retailGbp: 49,
      status: 'pending_payment',
      mock: true,
    };
  }
  if (!input.items?.length) {
    return { success: false, error: 'No items to order' };
  }
  try {
    const resp = await fetch(`${WORKER_URL}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({
        address: input.address,
        wkt: input.wkt,
        items: input.items,
        customerReference: input.customerReference,
        postcode: input.postcode,
        thirdPartyReference: input.thirdPartyReference,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return { success: false, error: data.error || 'Order failed' };
    }
    return {
      success: true,
      id: data.id,
      ourReference: data.ourReference,
      retailGbp: data.retailGbp,
      netGbp: data.netGbp,
      vatGbp: data.vatGbp,
      // Absent on a worker deployment that predates the drop behaviour, which
      // is indistinguishable from "nothing was dropped" and degrades the same.
      dropped: Array.isArray(data.dropped) ? data.dropped : [],
      orderedCodes: Array.isArray(data.orderedCodes) ? data.orderedCodes : undefined,
      status: data.status,
    };
  } catch (err) {
    logger.error('Groundsure placeOrder error:', err);
    return { success: false, error: 'Network error' };
  }
}

/**
 * POST /order, resolving the WKT site boundary for the property.
 *
 * This is the ergonomic entry point for the searches UI: it turns a UPRN and
 * postcode into the EPSG:27700 polygon Groundsure requires — the property's own
 * registered parcel where we have one, a box otherwise — then places the order.
 * Falls back to the mock path when the integration is disabled (so the demo
 * flow works without a real postcode lookup); when enabled, a postcode that
 * can't be resolved is a hard error rather than a silently-empty boundary.
 */
async function placeOrderForProperty(input: PlaceOrderForPropertyInput): Promise<OrderResult> {
  if (!input.items?.length) {
    return { success: false, error: 'No items to order' };
  }

  const resolved = await resolvePropertyBoundary({
    uprn: input.uprn,
    postcode: input.postcode,
    halfSizeMetres: input.halfSizeMetres,
  });

  if (!resolved) {
    if (disabled()) {
      // Mock mode — WKT isn't sent upstream, so don't block the demo on it.
      return placeOrder({ ...input, wkt: '' });
    }
    return {
      success: false,
      error:
        `Could not resolve a property boundary for postcode "${input.postcode}". ` +
        'Check the postcode and try again.',
    };
  }

  return placeOrder({
    address: input.address,
    wkt: resolved.wkt,
    items: input.items,
    customerReference: input.customerReference,
    postcode: input.postcode,
    thirdPartyReference: input.thirdPartyReference,
  });
}

/** GET /order/:ourReference — status read-through; self-completes by pulling docs + summary. */
async function getOrderStatus(ourReference: string): Promise<OrderStatusResult> {
  if (disabled()) {
    return { success: true, status: 'in_progress', mock: true };
  }
  try {
    const resp = await fetch(`${WORKER_URL}/order/${encodeURIComponent(ourReference)}`, {
      headers: { ...(await authHeaders()) },
    });
    const data = await resp.json();
    if (!resp.ok) {
      return { success: false, error: data.error || 'Status check failed' };
    }
    return {
      success: true,
      status: data.status,
      jsonSummary: data.jsonSummary,
      documents: data.documents,
    };
  } catch (err) {
    logger.error('Groundsure getOrderStatus error:', err);
    return { success: false, error: 'Network error' };
  }
}

export const groundsureService = {
  placeOrder,
  placeOrderForProperty,
  getOrderStatus,
};
