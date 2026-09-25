// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { supabase } from '../lib/supabase';

/**
 * Companies House lookup service (Task 1a.7).
 *
 * Thin client over the `companies-house-lookup` Supabase edge function.
 * The Companies House API key lives in the function's environment and
 * never reaches the browser. Frontend just passes a company number;
 * the function does the upstream call, normalises the response shape,
 * and returns either a `CompaniesHouseCompany` or `null`.
 *
 * On any error (404, timeout, 5xx, network, malformed input), this
 * function returns `null` rather than throwing. The caller is expected
 * to fall back to the manual entry path with `companies_house_verified
 * = false`.
 */

export interface CompaniesHouseCompany {
  companyNumber: string;
  name: string;
  status:
    | 'active'
    | 'dissolved'
    | 'liquidation'
    | 'receivership'
    | 'administration'
    | 'voluntary-arrangement'
    | 'converted-closed'
    | 'insolvency-proceedings'
    | 'registered'
    | 'removed'
    | 'unknown';
  incorporatedOn: string;
  address: {
    line1?: string;
    line2?: string;
    locality?: string;
    postalCode?: string;
    country?: string;
  };
  isActive: boolean;
}

// UK company numbers: 8 digits, OR 2-letter prefix + 6 digits.
const UK_COMPANY_NUMBER_RE = /^([0-9]{8}|[A-Z]{2}[0-9]{6})$/;

export function normalizeCompanyNumber(input: string): string | null {
  const cleaned = input.trim().toUpperCase();
  if (!UK_COMPANY_NUMBER_RE.test(cleaned)) return null;
  return cleaned;
}

export interface LookupOptions {
  signal?: AbortSignal;
}

export async function lookupCompany(
  companyNumber: string,
  opts: LookupOptions = {},
): Promise<CompaniesHouseCompany | null> {
  // Normalise + validate before the round trip.
  const normalized = normalizeCompanyNumber(companyNumber);
  if (!normalized) return null;

  // Honour an already-aborted signal so we don't hit the network at all.
  if (opts.signal?.aborted) return null;

  try {
    const { data, error } = await supabase.functions.invoke<
      CompaniesHouseCompany | null
    >('companies-house-lookup', {
      body: { companyNumber: normalized },
    });

    if (error) return null;
    if (!data) return null;
    return data;
  } catch {
    // supabase.functions.invoke can throw on network failure
    return null;
  }
}
