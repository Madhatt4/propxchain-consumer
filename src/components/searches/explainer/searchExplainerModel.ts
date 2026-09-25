// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Turns the location engine's flat recommendation list into the three groups
 * the explainer card renders. Pure — no JSX, no network, no React.
 */

import type {
  LocationSearchAnalysis,
  SearchRecommendation,
} from '../../../services/postcodeService';
import type { SearchType } from '../../../types/searches';
import { getAllSearchTypes, getSearchTypeById } from '../../../utils/searchTypes';

export interface ExplainerEntry {
  searchType: SearchType;
  reason: string;
  priority: 'required' | 'recommended' | 'optional';
  confidence: 'high' | 'medium' | 'low';
  /**
   * The engine is only sometimes sure. A hedged entry is phrased tentatively
   * by the view — the platform states what a conveyancer typically orders, it
   * does not make the regulated judgement itself.
   */
  hedged: boolean;
}

export interface ExplainerModel {
  required: ExplainerEntry[];
  recommended: ExplainerEntry[];
  /**
   * Location-specific searches this area does NOT need. As useful to a
   * customer as the ones it does — it is the money they are not spending.
   * Essential searches never appear here: they apply everywhere.
   */
  notNeeded: SearchType[];
}

function toEntry(rec: SearchRecommendation): ExplainerEntry | null {
  const searchType = getSearchTypeById(rec.searchTypeId);
  if (!searchType) return null;
  return {
    searchType,
    reason: rec.reason,
    priority: rec.priority,
    confidence: rec.confidence,
    hedged: rec.confidence === 'low',
  };
}

export function buildExplainerModel(analysis: LocationSearchAnalysis): ExplainerModel {
  const entries = analysis.recommendations
    .map(toEntry)
    .filter((entry): entry is ExplainerEntry => entry !== null);

  const recommendedIds = new Set(entries.map((entry) => entry.searchType.id));

  return {
    required: entries.filter((entry) => entry.priority === 'required'),
    recommended: entries.filter((entry) => entry.priority === 'recommended'),
    notNeeded: getAllSearchTypes().filter(
      (searchType) =>
        searchType.category === 'location-specific' && !recommendedIds.has(searchType.id),
    ),
  };
}
