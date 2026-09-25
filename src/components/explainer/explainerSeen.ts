// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Whether this browser has already shown a given explainer modal for a
 * transaction. Deliberately localStorage: a UI nicety, not transaction state.
 * The worst case on a new device is a useful explanation shown twice.
 *
 * `storageKey` namespaces each explainer, so dismissing the searches
 * explanation does not also dismiss the property-information one.
 */

const KEY_PREFIX = 'propxchain:explainer-seen:';

export function hasSeenExplainer(storageKey: string, transactionId: string): boolean {
  try {
    return window.localStorage.getItem(`${KEY_PREFIX}${storageKey}:${transactionId}`) === '1';
  } catch {
    // Private browsing or a storage-disabled context: treat as unseen. Showing
    // the modal again is strictly better than throwing on a transaction stage.
    return false;
  }
}

export function markExplainerSeen(storageKey: string, transactionId: string): void {
  try {
    window.localStorage.setItem(`${KEY_PREFIX}${storageKey}:${transactionId}`, '1');
  } catch {
    // Nothing to do — the modal simply shows again next visit.
  }
}
