// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Client for the `searches-explainer` edge function.
 *
 * Every failure returns null. The explainer card is complete and correct
 * without narration, so a failure here is a missing enhancement, never an
 * error the customer should see.
 */

import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

const FUNCTION_NAME = 'searches-explainer';

export interface CacheKeyInput {
  localAuthorityName: string;
  transactionType: string;
  capabilities: string[];
  requiredSearchIds: string[];
}

/**
 * Keyed on the AREA profile, not the property: the advice for a Barnsley
 * freehold sale is identical for every Barnsley freehold sale, so a few
 * hundred rows cover England and Wales.
 *
 * Both arrays are copied before sorting — sorting in place would reorder the
 * caller's memoised arrays and could churn a React dependency.
 */
export function buildCacheKey(input: CacheKeyInput): string {
  return [
    input.localAuthorityName.trim().toLowerCase(),
    input.transactionType,
    [...input.capabilities].sort().join(','),
    [...input.requiredSearchIds].sort().join(','),
  ].join('|');
}

export async function fetchNarration(
  cacheKey: string,
  analysis: Record<string, unknown>,
): Promise<string[] | null> {
  try {
    const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
      body: { cacheKey, analysis },
    });
    if (error) {
      logger.warn('Searches explainer narration unavailable:', error);
      return null;
    }
    const narration = (data as { narration?: unknown })?.narration;
    if (!Array.isArray(narration)) return null;
    return narration.filter((item): item is string => typeof item === 'string');
  } catch (err) {
    logger.warn('Searches explainer narration request failed:', err);
    return null;
  }
}
