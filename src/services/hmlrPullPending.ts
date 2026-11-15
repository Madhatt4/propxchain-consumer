// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The HMLR title pull's state across the Stripe redirect, kept in
 * localStorage so the pull resumes after the user returns — even from a
 * fresh tab. Moved out of HMLRTitlePullButton so the flow page can tell a
 * paid-but-unpulled title is waiting (and open the tab whose button will
 * resume it) without mounting the button.
 *
 * PaymentSuccessPage reads the same key to route the return.
 */

export const HMLR_PENDING_KEY = 'propxchain.hmlr.pull.pending';

// Pending state older than this is treated as abandoned and cleared so
// the user can start a fresh checkout without "you have a pending pull"
// blocking them indefinitely. 24h covers timezone-shifted returns +
// users who pay late in the evening and resume the next morning.
const PENDING_STATE_TTL_MS = 24 * 60 * 60 * 1000;

export interface PendingTitlePull {
  titleNumber: string;
  transactionId: string;
  startedAt: string;
  /** Stripe Checkout Session id, populated once we know it. */
  sessionId?: string;
}

export function savePendingState(state: PendingTitlePull): void {
  localStorage.setItem(HMLR_PENDING_KEY, JSON.stringify(state));
}

export function loadPendingState(): PendingTitlePull | null {
  const raw = localStorage.getItem(HMLR_PENDING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingTitlePull;
    const startedAtMs = Date.parse(parsed.startedAt);
    if (Number.isNaN(startedAtMs) || Date.now() - startedAtMs > PENDING_STATE_TTL_MS) {
      localStorage.removeItem(HMLR_PENDING_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(HMLR_PENDING_KEY);
    return null;
  }
}

export function clearPendingState(): void {
  localStorage.removeItem(HMLR_PENDING_KEY);
}

/** True when this device has a live pending pull for the transaction. */
export function hasPendingTitlePull(transactionId: string | undefined): boolean {
  if (!transactionId) return false;
  return loadPendingState()?.transactionId === transactionId;
}
