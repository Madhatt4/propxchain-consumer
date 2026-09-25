// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * What step 1 of the start-sale saga already minted for a listing, remembered
 * across the modal's lifetime (#251).
 *
 * Step 1 creates the on-chain transaction. If a later step fails, starting
 * again must resume rather than mint a second one and orphan the first. The
 * hook's ref covers Retry and close-then-reopen; this covers the case the ref
 * cannot, where the agent navigates away from the listing and comes back, so
 * the hook itself has been unmounted.
 *
 * sessionStorage, not localStorage, and deliberately: the memory should last
 * exactly as long as the tab the agent is working in. That bounds staleness
 * without inventing an expiry, and nothing here is worth carrying between
 * sessions — a finished sale clears it, and an unfinished one is a
 * transaction the next visit should resume.
 */

export interface PendingStartSale {
  transactionId: string;
  inviteCode: string;
}

const KEY_PREFIX = 'propxchain.startSale.pending.';

function key(listingId: string): string {
  return `${KEY_PREFIX}${listingId}`;
}

/** Remember what step 1 minted for this listing. Storage failures are never worth breaking a sale over. */
export function savePendingStartSale(listingId: string, pending: PendingStartSale): void {
  try {
    sessionStorage.setItem(key(listingId), JSON.stringify(pending));
  } catch {
    // Private mode, or a full quota. The in-memory ref still covers Retry.
  }
}

/** What step 1 minted for this listing on an earlier visit, if anything usable. */
export function loadPendingStartSale(listingId: string): PendingStartSale | null {
  try {
    const raw = sessionStorage.getItem(key(listingId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingStartSale>;
    if (typeof parsed.transactionId !== 'string' || parsed.transactionId.length === 0) return null;
    if (typeof parsed.inviteCode !== 'string' || parsed.inviteCode.length === 0) return null;
    return { transactionId: parsed.transactionId, inviteCode: parsed.inviteCode };
  } catch {
    return null;
  }
}

/** The sale completed: there is nothing left to resume. */
export function clearPendingStartSale(listingId: string): void {
  try {
    sessionStorage.removeItem(key(listingId));
  } catch {
    // Nothing to do; a stale entry only ever causes a resume of a real transaction.
  }
}
