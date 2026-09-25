// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Search-acceptance compatibility. Contract: given the transaction's original
 * pack-search issue date and each firm's declaration, decide whether that
 * firm will rely on the searches already ordered or order fresh ones.
 * Backed by public.conveyancer_search_declarations.
 *
 * The platform cannot infer acceptance — the Search Code makes a regulated
 * search relyable-upon by anyone, but firms still refuse on procurement
 * route (often tied to their own panel-provider commercials). So absence of
 * a declaration is `unknown`, never a default "accepts": a wrong "accepts"
 * sends a mover to a firm that will re-order and re-charge.
 */

import { supabase } from '../lib/supabase';
import type { Provider } from '../components/providers/types';

/** Below this many accepting firms the panel shows all firms + an explainer banner. */
export const MIN_COMPATIBLE_MATCHES = 3;

/** Lenders re-clock validity from the ORIGINAL search, never a refresh. */
const VALIDITY_WEEKS = 26;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

export type SearchCompatibility = 'accepts' | 'reorders' | 'unknown' | 'not_applicable';

/**
 * Single source of truth for badge copy — the decorator stamps these onto
 * `searchCompatibilityReason`, and the UI renders that field verbatim rather
 * than keeping its own literals, so the two can never drift apart. No entry
 * for `not_applicable`: that state renders no badge at all.
 */
export const SEARCH_COMPATIBILITY_REASONS: Record<Exclude<SearchCompatibility, 'not_applicable'>, string> = {
  accepts: 'Accepts your existing searches',
  reorders: 'Will order fresh searches',
  unknown: "Hasn't told us",
};

export interface SearchDeclaration {
  conveyancerId: string;
  acceptsSellerOrderedSearches: boolean | null;
  requiresOwnPanelProvider: boolean | null;
  reorderThresholdWeeks: number | null;
}

export interface SearchContext {
  /** ISO date the ORIGINAL search was issued. Null when the transaction has no pack searches. */
  originalSearchIssuedAt: string | null;
  /** Injected for testability. */
  now: Date;
}

interface SearchDeclarationRow {
  conveyancer_id: string;
  accepts_seller_ordered_searches: boolean | null;
  requires_own_panel_provider: boolean | null;
  reorder_threshold_weeks: number | null;
}

let declarationsCache: SearchDeclaration[] | null = null;

async function getDeclarations(): Promise<SearchDeclaration[]> {
  if (declarationsCache) return declarationsCache;
  const { data, error } = await supabase
    .from('conveyancer_search_declarations')
    .select('conveyancer_id, accepts_seller_ordered_searches, requires_own_panel_provider, reorder_threshold_weeks');
  if (error) throw new Error(`Failed to load search declarations: ${error.message}`);
  declarationsCache = ((data ?? []) as SearchDeclarationRow[]).map((r) => ({
    conveyancerId: r.conveyancer_id,
    acceptsSellerOrderedSearches: r.accepts_seller_ordered_searches,
    requiresOwnPanelProvider: r.requires_own_panel_provider,
    reorderThresholdWeeks: r.reorder_threshold_weeks,
  }));
  return declarationsCache;
}

function clearCache(): void {
  declarationsCache = null;
}

/**
 * Weeks of validity left, measured only from the ORIGINAL issue date — a
 * refresh buys updated information, not a new validity window, so this
 * function deliberately takes no refresh date at all.
 */
export function remainingValidityWeeks(originalSearchIssuedAt: string, now: Date): number {
  const elapsedMs = now.getTime() - new Date(originalSearchIssuedAt).getTime();
  const elapsedWeeks = elapsedMs / MS_PER_WEEK;
  return VALIDITY_WEEKS - elapsedWeeks;
}

/** Stamp each provider with its search compatibility for badge/filter rendering. Pure. */
export function decorateSearchCompatibility(
  providers: Provider[],
  declarations: readonly SearchDeclaration[],
  context: SearchContext,
): Provider[] {
  if (context.originalSearchIssuedAt === null) {
    return providers.map((p) => ({ ...p, searchCompatibility: 'not_applicable' as const }));
  }

  const remainingWeeks = remainingValidityWeeks(context.originalSearchIssuedAt, context.now);

  // An unparseable issue date must never silently resolve to "accepts" — the
  // one failure this feature must never have, since a wrong "accepts" sends
  // a mover to a firm that will re-order and re-charge. Treat it exactly
  // like a missing declaration: unknown for every firm, regardless of what
  // each firm has declared.
  if (Number.isNaN(remainingWeeks)) {
    return providers.map((p) => ({
      ...p,
      searchCompatibility: 'unknown' as const,
      searchCompatibilityReason: SEARCH_COMPATIBILITY_REASONS.unknown,
    }));
  }

  const byId = new Map(declarations.map((d) => [d.conveyancerId, d]));

  return providers.map((p) => {
    const declaration = byId.get(p.id);
    if (!declaration) {
      return {
        ...p,
        searchCompatibility: 'unknown' as const,
        searchCompatibilityReason: SEARCH_COMPATIBILITY_REASONS.unknown,
      };
    }

    const mustReorder =
      declaration.requiresOwnPanelProvider === true ||
      declaration.acceptsSellerOrderedSearches === false ||
      (declaration.reorderThresholdWeeks !== null && remainingWeeks <= declaration.reorderThresholdWeeks);

    if (mustReorder) {
      return {
        ...p,
        searchCompatibility: 'reorders' as const,
        searchCompatibilityReason: SEARCH_COMPATIBILITY_REASONS.reorders,
      };
    }

    return {
      ...p,
      searchCompatibility: 'accepts' as const,
      searchCompatibilityReason: SEARCH_COMPATIBILITY_REASONS.accepts,
    };
  });
}

export const searchCompatibilityService = { getDeclarations, clearCache };
