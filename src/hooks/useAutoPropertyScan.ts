// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Watches a postcode value and fires a scan callback once per distinct valid
 * UK postcode — debounced so mid-entry keystrokes don't fire, aborting the
 * previous scan when the postcode changes. Drives the automatic free property
 * scan on the list-property stage.
 */

import { useEffect, useRef } from 'react';

/** Full UK postcode (outward + inward). Outcode-only is NOT enough to scan. */
const FULL_UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

export function isValidUkPostcode(raw: string): boolean {
  return FULL_UK_POSTCODE_RE.test(raw.trim());
}

interface Options {
  /** Suppress all firing (e.g. while editing a confirmed listing). */
  disabled?: boolean;
  /** Debounce before firing after the postcode settles. Default 800 ms. */
  debounceMs?: number;
}

export function useAutoPropertyScan(
  postcode: string,
  onScan: (postcode: string, signal: AbortSignal) => void,
  opts: Options = {},
): void {
  const { disabled = false, debounceMs = 800 } = opts;

  // Latest callback without re-running the effect on every render.
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  // One scan per postcode value per mount (plan decision) — clearing and
  // retyping the same postcode does not re-fire.
  const lastScannedRef = useRef<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const normalized = postcode.trim().toUpperCase();

  useEffect(() => {
    // Any postcode change invalidates whatever scan is in flight — abort even
    // when the new value is invalid (user backspacing), or a stale result
    // could land against a field that no longer shows that postcode.
    controllerRef.current?.abort();
    controllerRef.current = null;

    if (disabled) return;
    if (!isValidUkPostcode(normalized)) return;
    if (lastScannedRef.current === normalized) return;

    const timer = setTimeout(() => {
      const controller = new AbortController();
      controllerRef.current = controller;
      lastScannedRef.current = normalized;
      onScanRef.current(normalized, controller.signal);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [normalized, disabled, debounceMs]);

  // Abort whatever is in flight when the stage unmounts.
  useEffect(() => () => controllerRef.current?.abort(), []);
}
