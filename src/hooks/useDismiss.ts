// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * useDismiss — small persistence hook for hideable cards.
 *
 * Backed by localStorage so dismissals survive reload but stay scoped to the
 * key the caller supplies (typically including a txId). Read failures fall
 * back to undismissed state — the card is decoration, not gate.
 *
 * Stored value: optional `tag` string (e.g. a blocker key) so callers can
 * implement "auto-revive when state changes" by passing a fresh tag and
 * comparing it to the stored one. When tag is omitted, dismiss is binary
 * (dismissed / not dismissed).
 */

import { useCallback, useEffect, useState } from 'react';

const KEY_PREFIX = 'dismissed:';

function read(storageKey: string): string | null {
  try {
    return localStorage.getItem(KEY_PREFIX + storageKey);
  } catch {
    return null;
  }
}

function write(storageKey: string, value: string): void {
  try {
    localStorage.setItem(KEY_PREFIX + storageKey, value);
  } catch {
    // Private mode / quota — degrade silently to per-render state.
  }
}

function clear(storageKey: string): void {
  try {
    localStorage.removeItem(KEY_PREFIX + storageKey);
  } catch {
    // ditto
  }
}

export interface UseDismissResult {
  /** Stored dismissal tag (e.g. blocker key). null when not dismissed. */
  dismissedTag: string | null;
  /** Persist a dismissal. Pass an empty string for tag-less binary dismiss. */
  dismiss: (tag?: string) => void;
  /** Clear the dismissal — restores the card. */
  restore: () => void;
}

export function useDismiss(storageKey: string): UseDismissResult {
  const [dismissedTag, setDismissedTag] = useState<string | null>(() =>
    read(storageKey),
  );

  // Re-read whenever the storage key changes — different tx, fresh state.
  useEffect(() => {
    setDismissedTag(read(storageKey));
  }, [storageKey]);

  const dismiss = useCallback(
    (tag = ''): void => {
      write(storageKey, tag);
      setDismissedTag(tag);
    },
    [storageKey],
  );

  const restore = useCallback((): void => {
    clear(storageKey);
    setDismissedTag(null);
  }, [storageKey]);

  return { dismissedTag, dismiss, restore };
}
