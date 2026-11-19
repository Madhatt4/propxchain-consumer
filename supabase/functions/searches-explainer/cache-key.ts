// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Request validation and server-side cache key for searches-explainer.
 *
 * WHY: the cache used to be keyed on a string the client sent alongside the
 * analysis. The key was predictable (area | transaction | capabilities |
 * search ids), so one signed-in user could store narration generated from a
 * crafted analysis under an area's key and every later customer in that area
 * was shown it. The key is now a SHA-256 over exactly the bytes sent to the
 * model, so a cached narration can only ever be served for the identical
 * input that produced it.
 *
 * parseAnalysis rebuilds the analysis field by field, in a fixed order, from
 * values that passed the checks below. Unknown fields are dropped, so nothing
 * reaches the model or the hash that is not listed here.
 */

import type { AnalysisRecommendation, ExplainerAnalysis } from './types.ts';

// Sized at a few times the largest real value (src/utils/searchRegionMapping.ts
// reasons are ~100 chars, a full analysis has ~15 recommendations), so a
// legitimate request never trips them but a prompt-stuffing one does.
export const LIMITS = {
  localAuthorityName: 120,
  capabilityItems: 30,
  capabilityLength: 64,
  recommendationItems: 40,
  reasonLength: 300,
  notNeededItems: 40,
  notNeededLength: 120,
} as const;

const TRANSACTION_TYPES = ['sale', 'purchase', 'new-build'] as const;
const PRIORITIES = ['required', 'recommended', 'optional'] as const;
const CONFIDENCES = ['high', 'medium', 'low'] as const;
const SEARCH_TYPE_ID = /^[a-z0-9-]{1,64}$/;

// Bumping this invalidates every cached row at once, should the model input
// shape ever change meaning without changing bytes.
const KEY_VERSION = 'searches-explainer:v2';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

function stringList(value: unknown, maxItems: number, maxLength: number): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const out: string[] = [];
  for (const item of value) {
    const s = boundedString(item, maxLength);
    if (s === null) return null;
    out.push(s);
  }
  return out;
}

function parseRecommendation(value: unknown): AnalysisRecommendation | null {
  if (!isRecord(value)) return null;
  const searchTypeId = typeof value.searchTypeId === 'string' && SEARCH_TYPE_ID.test(value.searchTypeId)
    ? value.searchTypeId
    : null;
  const reason = boundedString(value.reason, LIMITS.reasonLength);
  const priority = oneOf(value.priority, PRIORITIES);
  const confidence = oneOf(value.confidence, CONFIDENCES);
  if (!searchTypeId || !reason || !priority || !confidence) return null;
  // Key order fixed here: it is part of the hashed serialisation.
  return { searchTypeId, reason, priority, confidence };
}

/** Returns a canonical copy of a valid analysis, or null if any field fails. */
export function parseAnalysis(value: unknown): ExplainerAnalysis | null {
  if (!isRecord(value)) return null;
  const localAuthorityName = boundedString(value.localAuthorityName, LIMITS.localAuthorityName);
  const transactionType = oneOf(value.transactionType, TRANSACTION_TYPES);
  const capabilities = stringList(value.capabilities, LIMITS.capabilityItems, LIMITS.capabilityLength);
  const notNeeded = stringList(value.notNeeded, LIMITS.notNeededItems, LIMITS.notNeededLength);
  if (!localAuthorityName || !transactionType || !capabilities || !notNeeded) return null;

  const rawRecs = value.recommendations;
  if (!Array.isArray(rawRecs) || rawRecs.length === 0 || rawRecs.length > LIMITS.recommendationItems) {
    return null;
  }
  const recommendations: AnalysisRecommendation[] = [];
  for (const raw of rawRecs) {
    const rec = parseRecommendation(raw);
    if (!rec) return null;
    recommendations.push(rec);
  }

  return { localAuthorityName, transactionType, capabilities, recommendations, notNeeded };
}

/**
 * The exact string sent to the model as the user message. Hashing this same
 * string is what binds a cached narration to its input.
 */
export function serialiseAnalysis(analysis: ExplainerAnalysis): string {
  return JSON.stringify(analysis);
}

/** Hex SHA-256 over the versioned model input. */
export async function deriveCacheKey(modelInput: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${KEY_VERSION}\n${modelInput}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
