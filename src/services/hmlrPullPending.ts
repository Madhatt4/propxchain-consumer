// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The HMLR title pull's state across the Stripe redirect, kept in
 * localStorage so the pull resumes after the user returns — even from a
 * fresh tab. Moved out of HMLRTitlePullButton so the flow page and the Sales
 * pack can tell a paid-but-unpulled title is waiting without mounting the
 * button. PaymentSuccessPage reads the same key to route the return.
 *
 * Storage can be blocked (Safari private mode, a locked-down profile): every
 * read treats a failure as "nothing pending" and a failed save reports false,
 * so the flow page never crashes on it.
 *
 * The resume claim: Stage 1 and the pack each mount their own button, and a
 * resume outlives the button that started it (switching tabs unmounts it but
 * the promise runs on). Without a claim, the newly mounted button would verify
 * and pull the same paid session again, and the loser would refund or show
 * "card charged". One resume per deal at a time: a module-level set covers
 * this tab, an `inFlightAt` stamp on the stored record covers other tabs.
 */
import { logger } from '@/utils/logger';

export const HMLR_PENDING_KEY = 'propxchain.hmlr.pull.pending';

// Pending state older than this is treated as abandoned and cleared so
// the user can start a fresh checkout without "you have a pending pull"
// blocking them indefinitely. 24h covers timezone-shifted returns +
// users who pay late in the evening and resume the next morning.
const PENDING_STATE_TTL_MS = 24 * 60 * 60 * 1000;

// A resume (verify + HMLR pull + refund) finishes well inside this. A stamp
// older than it belongs to a tab that died mid-resume, so it no longer blocks.
const IN_FLIGHT_TTL_MS = 5 * 60 * 1000;

export interface PendingTitlePull {
  titleNumber: string;
  transactionId: string;
  startedAt: string;
  /** Stripe Checkout Session id, populated once we know it. */
  sessionId?: string;
  /** Set while a tab is resuming this pull; see claimResume. */
  inFlightAt?: string;
}

/** False when storage refused the write; the caller must not redirect to Stripe. */
export function savePendingState(state: PendingTitlePull): boolean {
  try {
    localStorage.setItem(HMLR_PENDING_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    logger.warn('Could not save the pending HMLR title pull', err);
    return false;
  }
}

function removePending(): void {
  try {
    localStorage.removeItem(HMLR_PENDING_KEY);
  } catch (err) {
    logger.warn('Could not clear the pending HMLR title pull', err);
  }
}

function isOlderThan(iso: string | undefined, ttlMs: number): boolean {
  const ms = Date.parse(iso ?? '');
  return Number.isNaN(ms) || Date.now() - ms > ttlMs;
}

export function loadPendingState(): PendingTitlePull | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(HMLR_PENDING_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingTitlePull;
    if (isOlderThan(parsed.startedAt, PENDING_STATE_TTL_MS)) {
      removePending();
      return null;
    }
    return parsed;
  } catch {
    removePending();
    return null;
  }
}

export function clearPendingState(): void {
  removePending();
}

/** This device's live pending pull for the transaction, if any. */
export function getPendingTitlePull(transactionId: string | undefined): PendingTitlePull | null {
  if (!transactionId) return null;
  const pending = loadPendingState();
  return pending?.transactionId === transactionId ? pending : null;
}

export function hasPendingTitlePull(transactionId: string | undefined): boolean {
  return getPendingTitlePull(transactionId) !== null;
}

const inFlight = new Set<string>();
const releaseListeners = new Set<(transactionId: string) => void>();

/**
 * Take the deal's one resume slot, synchronously, before any verifySession.
 * False when this tab or another one already holds it: the caller must not
 * verify, pull or refund, only show the pending state and wait.
 */
export function claimResume(transactionId: string): boolean {
  if (inFlight.has(transactionId)) return false;
  const pending = getPendingTitlePull(transactionId);
  if (pending?.inFlightAt && !isOlderThan(pending.inFlightAt, IN_FLIGHT_TTL_MS)) return false;
  inFlight.add(transactionId);
  if (pending) savePendingState({ ...pending, inFlightAt: new Date().toISOString() });
  return true;
}

/** True while this tab or another holds the deal's resume slot. */
export function isResumeInFlight(transactionId: string): boolean {
  if (inFlight.has(transactionId)) return true;
  const stamp = getPendingTitlePull(transactionId)?.inFlightAt;
  return Boolean(stamp) && !isOlderThan(stamp, IN_FLIGHT_TTL_MS);
}

/** Give the slot back (after success, failure or "not paid yet") and wake any waiting button. */
export function releaseResume(transactionId: string): void {
  inFlight.delete(transactionId);
  const pending = getPendingTitlePull(transactionId);
  if (pending?.inFlightAt) {
    savePendingState({ ...pending, inFlightAt: undefined });
  }
  releaseListeners.forEach((listener) => listener(transactionId));
}

/**
 * Call `listener` when a resume for this deal is released here, or when
 * another tab changes the pending record. Returns the unsubscribe.
 */
export function onResumeReleased(transactionId: string, listener: () => void): () => void {
  const local = (released: string): void => {
    if (released === transactionId) listener();
  };
  const crossTab = (e: StorageEvent): void => {
    if (e.key === HMLR_PENDING_KEY) listener();
  };
  releaseListeners.add(local);
  window.addEventListener('storage', crossTab);
  return () => {
    releaseListeners.delete(local);
    window.removeEventListener('storage', crossTab);
  };
}
