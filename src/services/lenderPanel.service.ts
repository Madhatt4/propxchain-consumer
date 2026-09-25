// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Lender conveyancing-panel lookups. Contract: given nothing → the known
 * lender names; given a lender → the conveyancer_panel ids on that lender's
 * panel (precomputed server-side — no fuzzy matching here).
 * Backed by public.lender_names / public.conveyancer_lender_panels.
 */

import { supabase } from '../lib/supabase';
import type { Provider } from '../components/providers/types';

/** Below this many matches the panel shows all firms + an explainer banner. */
export const MIN_PANEL_MATCHES = 3;

let lendersCache: string[] | null = null;
const panelIdsCache = new Map<string, string[]>();

async function getLenders(): Promise<string[]> {
  if (lendersCache) return lendersCache;
  const { data, error } = await supabase
    .from('lender_names')
    .select('lender_name')
    .order('lender_name', { ascending: true });
  if (error) throw new Error(`Failed to load lenders: ${error.message}`);
  lendersCache = (data ?? []).map((r: { lender_name: string }) => r.lender_name).sort();
  return lendersCache;
}

async function getPanelConveyancerIds(lenderName: string): Promise<string[]> {
  const cached = panelIdsCache.get(lenderName);
  if (cached) return cached;
  const { data, error } = await supabase
    .from('conveyancer_lender_panels')
    .select('conveyancer_id')
    .eq('lender_name', lenderName);
  if (error) throw new Error(`Failed to load lender panel: ${error.message}`);
  const ids = (data ?? []).map((r: { conveyancer_id: string }) => r.conveyancer_id);
  panelIdsCache.set(lenderName, ids);
  return ids;
}

function clearCache(): void {
  lendersCache = null;
  panelIdsCache.clear();
}

/** Stamp each provider with its panel status for badge rendering. Pure. */
export function decorateProviders(
  providers: Provider[],
  panelIds: readonly string[],
  lenderName: string,
): Provider[] {
  const allow = new Set(panelIds);
  return providers.map((p) => ({
    ...p,
    lenderPanelStatus: allow.has(p.id) ? ('on' as const) : ('off' as const),
    lenderPanelName: lenderName,
  }));
}

export const lenderPanelService = { getLenders, getPanelConveyancerIds, clearCache };
