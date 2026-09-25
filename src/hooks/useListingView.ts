// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Remembers the estate agent's tile / list choice. It is a per-browser
 * convenience, so it lives in localStorage rather than the profile.
 */

import { useState } from 'react';

export type ListingView = 'tiles' | 'list';

const STORAGE_KEY = 'estate-agent.listings.view';

function readStoredView(): ListingView {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'list' ? 'list' : 'tiles';
  } catch {
    return 'tiles';
  }
}

export function useListingView(): [ListingView, (view: ListingView) => void] {
  const [view, setView] = useState<ListingView>(readStoredView);
  const choose = (next: ListingView): void => {
    setView(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode or blocked storage: the in-memory choice still applies.
    }
  };
  return [view, choose];
}
