// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { supabase } from '../lib/supabase';

/**
 * CLC (Council for Licensed Conveyancers) lookup service.
 *
 * Reads from the public.clc_practices Supabase table, seeded from the
 * CLC's public register CSV. Used by RegisterConveyancerPage for inline
 * autofill during sign-up — mirrors the Companies House flow used for
 * developer registration.
 *
 * The register is public data on clc-uk.org so there are no confidentiality
 * concerns. RLS on clc_practices allows read to anon + authenticated.
 *
 * On any error or miss this function returns null. The caller is expected
 * to fall back to an unverified path so a firm that's CLC-licensed but not
 * in our snapshot (newly admitted, or the CSV lags) can still continue.
 */

export interface ClcPractice {
  clcId: string;
  practiceName: string;
  address: string | null;
  city: string | null;
  county: string | null;
  postCode: string | null;
  telephone: string | null;
  email: string | null;
  website: string | null;
  businessType: string | null;
  status: string;
  regulatedFrom: string | null;
  services: string | null;
  isActive: boolean;
}

const CLC_ID_RE = /^\d{3,6}$/;

export function normalizeClcId(input: string): string | null {
  const cleaned = input.trim();
  if (!CLC_ID_RE.test(cleaned)) return null;
  return cleaned;
}

interface ClcRow {
  clc_id: string;
  practice_name: string;
  address: string | null;
  city: string | null;
  county: string | null;
  post_code: string | null;
  telephone: string | null;
  email: string | null;
  website: string | null;
  business_type: string | null;
  status: string;
  regulated_from: string | null;
  services: string | null;
}

function rowToPractice(row: ClcRow): ClcPractice {
  return {
    clcId: row.clc_id,
    practiceName: row.practice_name,
    address: row.address,
    city: row.city,
    county: row.county,
    postCode: row.post_code,
    telephone: row.telephone,
    email: row.email,
    website: row.website,
    businessType: row.business_type,
    status: row.status,
    regulatedFrom: row.regulated_from,
    services: row.services,
    isActive: (row.status || '').toLowerCase() === 'active',
  };
}

export async function lookupPracticeByClcId(
  clcId: string,
): Promise<ClcPractice | null> {
  const normalised = normalizeClcId(clcId);
  if (!normalised) return null;

  const { data, error } = await supabase
    .from('clc_practices')
    .select(
      'clc_id, practice_name, address, city, county, post_code, telephone, email, website, business_type, status, regulated_from, services',
    )
    .eq('clc_id', normalised)
    .maybeSingle();

  if (error || !data) return null;
  return rowToPractice(data as ClcRow);
}
