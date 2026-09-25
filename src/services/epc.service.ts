// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * EPC (Energy Performance Certificate) lookup service.
 *
 * Thin client over the `epc-lookup` Supabase edge function. The MHCLG bearer
 * token lives in the function's environment and never reaches the browser.
 * The frontend passes a postcode (and optionally the property's address line
 * to disambiguate multiple dwellings on the postcode); the function searches
 * the EPC register, fetches the best-matching certificate for its rich fields
 * (floor area, potential band, ratings), and returns either an
 * `EpcCertificate` or `null`.
 *
 * On any error (no certificate, timeout, 5xx, network, malformed input) this
 * returns `null` rather than throwing — the property-intelligence panel treats
 * `null` as "source unavailable" and degrades gracefully.
 *
 * Note: the legacy `epc.opendatacommunities.org` open-data API was retired on
 * 30 May 2026; this flows through the replacement MHCLG service. See the
 * `epc-lookup` function source for the upstream contract.
 */

import { supabase } from '../lib/supabase';

/** EPC energy-efficiency band — A (best) … G (worst). */
export type EpcBand = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface EpcCertificate {
  /** Single-line address as held by the EPC register. */
  address: string;
  postcode: string;
  /** UPRN from the EPC register, when present. Lets the list-property flow
   *  auto-fill the property identity (and unlock the precise OS Open UPRN pin)
   *  without the seller knowing their UPRN. Null when the register has none. */
  uprn: string | null;
  /** Current energy-efficiency band. */
  currentBand: EpcBand;
  /** Potential band after recommended improvements, if known. */
  potentialBand: EpcBand | null;
  /** Current energy-efficiency rating, 1–100 (higher is better). */
  currentRating: number | null;
  /** Potential rating after improvements, 1–100. */
  potentialRating: number | null;
  /** Total floor area in square metres — powers the £/m² derivation. */
  floorAreaSqm: number | null;
  /** ISO date the certificate was lodged (YYYY-MM-DD). */
  lodgementDate: string | null;
  /** Whether the property meets domestic MEES (band E or better). */
  meetsMees: boolean;
}

export interface EpcLookupOptions {
  /** Address line to disambiguate multiple certificates on a postcode. */
  addressLine?: string;
  signal?: AbortSignal;
}

/**
 * Look up the best-matching EPC certificate for a postcode (optionally narrowed
 * by an address line). Returns `null` on any error or miss — callers must treat
 * `null` as "source unavailable" and never fabricate data.
 */
export async function lookupEpc(
  postcode: string,
  opts: EpcLookupOptions = {},
): Promise<EpcCertificate | null> {
  const normalized = postcode.trim();
  if (!normalized) return null;
  if (opts.signal?.aborted) return null;

  try {
    const { data, error } = await supabase.functions.invoke<EpcCertificate | null>('epc-lookup', {
      body: { postcode: normalized, addressLine: opts.addressLine },
      // Forward the abort signal so a stale scan cancels the request itself
      // (not just discards the result) — saves the shared EPC rate budget.
      signal: opts.signal,
    });
    if (error) return null;
    if (!data) return null;
    return data;
  } catch {
    // supabase.functions.invoke can throw on network failure
    return null;
  }
}
