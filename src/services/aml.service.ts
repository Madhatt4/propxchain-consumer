// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Client for the AML Cloudflare Worker (Verify365 first, not only).
 *
 * Three rails shape this file, all inherited from the searches money path:
 *
 *  1. THE CLIENT NEVER SUPPLIES A PRICE. Tier prices come from GET /pricing so
 *     the figure lives server-side; /order stamps it on the row and
 *     payment-worker re-derives the charge from that row. There is deliberately
 *     no mock path and no fallback price — an invented number is the original
 *     searches bug and it is not coming back here.
 *  2. NO PII CROSSES THIS BOUNDARY. A check is addressed by the subject's
 *     principal; the worker resolves that to its own party record. Nothing here
 *     carries a name, date of birth, document or result — only status and a
 *     pointer to where the report lives (the Transaction Wallet).
 *  3. FACT, NOT VERDICT. The provider warrants the pipe, not the data, and the
 *     compliance decision sits with the conveyancer. Statuses describe what has
 *     happened to the check, never whether a person "passed".
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';

import { FEATURE_FLAGS } from '../config/features';

/** Lite is not Safe Harbour compliant (their own agreement) and is not offered. */
export type AmlTier = 'standard' | 'enhanced';

export type AmlCheckStatus = 'pending' | 'in_progress' | 'complete' | 'failed';
export type AmlPaymentStatus = 'unpaid' | 'paid';

export interface AmlTierPrice {
  tier: AmlTier;
  /** What the customer pays, inc VAT — the one figure the UI shows. */
  retailPence: number;
}

/**
 * Who actually runs the checks, as the worker declares it. The panel brands
 * itself with this so it is plain that the provider, not PropXchain, performs
 * the check — and because ADR 0015 §1 wants provider identity data-driven, a
 * second supplier is a worker change, never a copy edit here.
 */
export interface AmlProvider {
  id: string;
  name: string;
}

export interface AmlPricing {
  /** Null only when talking to a worker that predates the provider field. */
  provider: AmlProvider | null;
  tiers: AmlTierPrice[];
}

export interface AmlCheck {
  id: string;
  transactionId: string;
  /** Who the check is about. A principal, never a name. */
  subjectPrincipal: string;
  tier: AmlTier;
  status: AmlCheckStatus;
  paymentStatus: AmlPaymentStatus;
  retailPence: number;
  createdAt: string;
  completedAt: string | null;
  /** True once the report has dropped into the Transaction Wallet. */
  hasReport: boolean;
  /** Which provider is running this check, e.g. 'verify365'. Drives display copy. */
  provider: string;
}

export interface AmlOrder {
  id: string;
  retailPence: number;
}

/**
 * The subject's own contact details. Passed straight through to the provider
 * and never stored by PropXchain — Verify365 contacts the person directly, so
 * these must be theirs. This is the ONE thing that crosses this boundary; the
 * check itself is still addressed by principal.
 */
export interface AmlPersonalDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

function workerUrl(): string {
  return import.meta.env.VITE_AML_WORKER_URL || '';
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function assertEnabled(): string {
  const url = workerUrl();
  if (!FEATURE_FLAGS.AML_ENABLED || !url) {
    throw new Error('ID & AML checks are not available yet');
  }
  return url;
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string; message?: string };
    return body.message || body.error || fallback;
  } catch {
    return fallback;
  }
}

function isTier(value: unknown): value is AmlTier {
  return value === 'standard' || value === 'enhanced';
}

class AmlService {
  /** Server-derived tier prices and the provider behind them. Throws rather than guessing when unavailable. */
  async getPricing(): Promise<AmlPricing> {
    const url = assertEnabled();
    const response = await fetch(`${url}/pricing`, { headers: await authHeaders() });
    if (!response.ok) throw new Error(await readError(response, 'Could not load AML pricing'));
    const body = (await response.json()) as { tiers?: AmlTierPrice[]; provider?: Partial<AmlProvider> };
    const tiers = (body.tiers ?? []).filter((t) => isTier(t.tier) && Number.isInteger(t.retailPence) && t.retailPence > 0);
    if (tiers.length === 0) throw new Error('AML pricing is not configured');
    const provider =
      body.provider && typeof body.provider.id === 'string' && typeof body.provider.name === 'string' && body.provider.name.trim()
        ? { id: body.provider.id, name: body.provider.name.trim() }
        : null;
    return { provider, tiers };
  }

  /** Every check on a deal, for any party. Rows are pseudonymous. */
  async listChecks(transactionId: string): Promise<AmlCheck[]> {
    const url = assertEnabled();
    const response = await fetch(`${url}/checks?transactionId=${encodeURIComponent(transactionId)}`, {
      headers: await authHeaders(),
    });
    if (!response.ok) throw new Error(await readError(response, 'Could not load ID & AML checks'));
    const body = (await response.json()) as { checks?: AmlCheck[] };
    return body.checks ?? [];
  }

  /**
   * Create an unpaid check row. Places NOTHING with the provider — that happens
   * on /order/:id/confirm-payment after Stripe, worker-side.
   */
  async createOrder(input: {
    transactionId: string;
    subjectPrincipal: string;
    tier: AmlTier;
    personalDetails: AmlPersonalDetails;
  }): Promise<AmlOrder> {
    const url = assertEnabled();
    const response = await fetch(`${url}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const message = await readError(response, 'Could not start the ID & AML check');
      logger.warn('[aml] order refused', { status: response.status, message });
      throw new Error(message);
    }
    const body = (await response.json()) as Partial<AmlOrder>;
    if (!body.id || !Number.isInteger(body.retailPence)) {
      throw new Error('AML worker returned an incomplete order');
    }
    return { id: body.id, retailPence: body.retailPence as number };
  }

  /** Short-lived signed URL for the subject's own report. */
  async reportUrl(checkId: string): Promise<string> {
    const url = assertEnabled();
    const response = await fetch(`${url}/checks/${encodeURIComponent(checkId)}/report`, {
      headers: await authHeaders(),
    });
    if (!response.ok) throw new Error(await readError(response, 'Report is not available yet'));
    const body = (await response.json()) as { url?: string };
    if (!body.url) throw new Error('Report is not available yet');
    return body.url;
  }
}

/** Stripe productRef for an AML order — 'aml' is the worker's category prefix, not the provider. */
export function amlProductRef(orderId: string): string {
  return `aml:${orderId}`;
}

export const amlService = new AmlService();
