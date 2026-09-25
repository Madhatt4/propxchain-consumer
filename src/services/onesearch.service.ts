// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Client for the OneSearch (PISCES) Cloudflare Worker. The worker proxies
 * orders to OneSearch's PISCES endpoint and persists state in Supabase. The
 * authoritative protocol contract lives in
 * `packages/onesearch-pisces/src/types.js` in the monorepo — the types here
 * mirror that JSDoc shape and must stay in sync.
 *
 * Worker contract:
 *   POST /order              → { address, boundary?, products, clientReference? }
 *                              returns { id, ourReference, retailGbp, netGbp, vatGbp, status: 'pending_payment' }
 *                              (prices + persists a row; the real order is placed once
 *                              stripe-webhook confirms payment)
 *   GET  /products?postcode= → 501 stub (catalogue is hardcoded from Jamie, not API-driven)
 *   GET  /order/:ref         → 501 stub (status read-through; small follow-up)
 *
 * Webhook receivers (/webhook/results, /webhook/status) are upstream-only —
 * OneSearch pushes async results to them and the worker persists to
 * onesearch_orders. To read results, query Supabase directly via
 * searchOrderService, not the worker.
 */

import { FEATURE_FLAGS } from '../config/features';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';

const WORKER_URL = import.meta.env.VITE_ONESEARCH_WORKER_URL || '';

/** Authorization header carrying the current Supabase access token (worker requires it). */
async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Types mirrored from @propxchain/onesearch-pisces ────────────────────
// Keep field names and optionality byte-for-byte aligned with types.js.

export interface PAFAddress {
  organisation?: string;
  subBuildingName?: string;
  buildingName?: string;
  buildingNumber?: string;
  dependantThoroughfareName?: string;
  thoroughfareName?: string;
  dependantLocality?: string;
  postTown: string;
  county?: string;
  postCode: string;
}

export type BoundaryDescriptor =
  | { planAttachment: { contentBase64: string; title?: string; mimeType?: 'PDF' | 'PNG' | 'JPEG' } }
  | { wkt: string }
  | { landregPlan: true };

export interface OneSearchProduct {
  productType: string;
  expedited?: boolean;
  supplierReference?: string;
}

export interface PlaceOrderInput {
  address: PAFAddress;
  products: OneSearchProduct[];
  boundary?: BoundaryDescriptor;
  clientReference?: string;
}

// ─── Service result shapes ──────────────────────────────────────────────

interface OrderResult {
  success: boolean;
  id?: string;
  ourReference?: string;
  /** GROSS, VAT-inclusive — the figure Stripe charges. Do not add VAT again. */
  retailGbp?: number;
  /** Ex-VAT rate card behind retailGbp. */
  netGbp?: number;
  /** Output VAT contained within retailGbp. */
  vatGbp?: number;
  status?: 'pending_payment' | 'acknowledged' | 'rejected' | 'processing';
  supplierReference?: string;
  facilitatorReference?: string;
  requesterReference?: string;
  errorMessage?: string;
  mock?: boolean;
  error?: string;
}

interface SearchProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  turnaroundDays: number;
}

interface ProductsResult {
  success: boolean;
  products?: SearchProduct[];
  mock?: boolean;
  error?: string;
}

interface OrderStatusResult {
  success: boolean;
  status?: string;
  estimatedCompletion?: string;
  mock?: boolean;
  error?: string;
}

interface ResultsResult {
  success: boolean;
  results?: unknown[];
  mock?: boolean;
  error?: string;
}

// ─── Methods ────────────────────────────────────────────────────────────

/** POST /order — price + persist a pending-payment OneSearch order (not yet placed). */
async function placeOrder(input: PlaceOrderInput): Promise<OrderResult> {
  if (!FEATURE_FLAGS.ONESEARCH_ENABLED || !WORKER_URL) {
    return {
      success: true,
      id: 'OS-MOCK-ROW-ID',
      ourReference: 'OS-MOCK-001',
      retailGbp: 144,
      netGbp: 120,
      vatGbp: 24,
      status: 'pending_payment',
      supplierReference: 'OS-MOCK-SUPPLIER-001',
      mock: true,
    };
  }

  try {
    const body = {
      clientReference: input.clientReference,
      address: input.address,
      boundary: input.boundary ?? { landregPlan: true },
      products: input.products,
    };
    const resp = await fetch(`${WORKER_URL}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(body),
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
      status: data.status,
    };
  } catch (err) {
    logger.error('OneSearch placeOrder error:', err);
    return { success: false, error: 'Network error' };
  }
}

async function getAvailableProducts(postcode: string): Promise<ProductsResult> {
  if (!FEATURE_FLAGS.ONESEARCH_ENABLED || !WORKER_URL) {
    return {
      success: true,
      products: [
        { id: 'local-authority', name: 'Local Authority Search', description: 'Full LLC1 + CON29R', price: 120, turnaroundDays: 10 },
        { id: 'drainage', name: 'Drainage & Water Search', description: 'Thames Water / regional', price: 45, turnaroundDays: 5 },
        { id: 'environmental', name: 'Environmental Search', description: 'Contaminated land & flood risk', price: 38, turnaroundDays: 2 },
      ],
      mock: true,
    };
  }

  try {
    const resp = await fetch(`${WORKER_URL}/products?postcode=${encodeURIComponent(postcode)}`, {
      headers: await authHeaders(),
    });
    // Worker stubs this 501 until the catalogue endpoint is implemented.
    // Treat as "no API-driven catalogue available" — callers use the
    // hardcoded list in searchProviderData.ts instead.
    if (resp.status === 501) {
      return { success: true, products: [], mock: false };
    }
    const data = await resp.json();
    if (!resp.ok) {
      return { success: false, error: data.error || 'Failed to fetch products' };
    }
    return { success: true, products: data.products || data };
  } catch (err) {
    logger.error('OneSearch getAvailableProducts error:', err);
    return { success: false, error: 'Network error' };
  }
}

async function getOrderStatus(ourReference: string): Promise<OrderStatusResult> {
  if (!FEATURE_FLAGS.ONESEARCH_ENABLED || !WORKER_URL) {
    return {
      success: true,
      status: 'processing',
      estimatedCompletion: '3-5 business days',
      mock: true,
    };
  }

  try {
    const resp = await fetch(`${WORKER_URL}/order/${encodeURIComponent(ourReference)}`, {
      headers: await authHeaders(),
    });
    // Worker stubs this 501 until the read-through is implemented. Callers
    // should poll Supabase via searchOrderService for now.
    if (resp.status === 501) {
      return { success: true, status: 'processing', mock: false };
    }
    const data = await resp.json();
    if (!resp.ok) {
      return { success: false, error: data.error || 'Status check failed' };
    }
    return {
      success: true,
      status: data.status,
      estimatedCompletion: data.estimatedCompletion,
    };
  } catch (err) {
    logger.error('OneSearch getOrderStatus error:', err);
    return { success: false, error: 'Network error' };
  }
}

async function getResults(_ourReference: string): Promise<ResultsResult> {
  // The worker has no /results endpoint — async results are pushed to
  // /webhook/results by OneSearch and persisted to public.onesearch_orders.
  // Consumers should query Supabase directly via searchOrderService.
  return { success: true, results: [], mock: true };
}

export const onesearchService = {
  getAvailableProducts,
  placeOrder,
  getOrderStatus,
  getResults,
};
