// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Best-effort localStorage cache for the free property-intelligence sources.
 * Shared by propertyIntelligenceService and groundRiskService so a repeat
 * check of the same address does not re-hit rate-limited public APIs.
 */

const STORAGE_PREFIX = 'propxchain:pi:';

interface CachedEnvelope<T> {
  value: T;
  storedAt: number;
  ttlMs: number;
}

export function readCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as CachedEnvelope<T>;
    if (Date.now() - envelope.storedAt > envelope.ttlMs) {
      window.localStorage.removeItem(STORAGE_PREFIX + key);
      return null;
    }
    return envelope.value;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T, ttlMs: number): void {
  if (typeof window === 'undefined') return;
  try {
    const envelope: CachedEnvelope<T> = { value, storedAt: Date.now(), ttlMs };
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(envelope));
  } catch {
    // localStorage quota exceeded or blocked — caching is best-effort.
  }
}
