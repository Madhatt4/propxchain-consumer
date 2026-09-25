// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { supabase } from '../lib/supabase';
import type { Provider } from '../components/providers/types';
import { rowToProvider, type ConveyancerPanelRow } from './supabaseProviderDataSource';

const DEFAULT_LIMIT = 10;

function sanitize(query: string): string {
  return query.replace(/[^A-Za-z0-9 \-'&]/g, ' ').trim();
}

export async function searchConveyancerPanel(
  query: string,
  limit: number = DEFAULT_LIMIT,
): Promise<Provider[]> {
  const safe = sanitize(query);
  if (safe.length < 2) return [];

  const pattern = `%${safe}%`;
  const { data, error } = await supabase
    .from('conveyancer_panel')
    .select('*')
    .eq('active_on_panel', true)
    .eq('status', 'Active')
    .or(
      `practice_name.ilike.${pattern},city.ilike.${pattern},postcode.ilike.${pattern}`,
    )
    .order('practice_name', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Conveyancer search failed: ${error.message}`);
  }

  const rows: ConveyancerPanelRow[] = data ?? [];
  return rows.map((r) => rowToProvider(r));
}
