// PropXchain — SPDX-License-Identifier: Proprietary

/**
 * Helpers for the VMC chain-unlock Stripe-checkout resume flow, split out
 * from ChainUnlockButton.tsx so PaymentSuccessPage.tsx (a different route,
 * mounted after the Stripe redirect) can read the same pending-unlock stash
 * ChainUnlockButton wrote before redirecting — the two never share a
 * component tree, only this module and localStorage. Mirrors
 * searchCheckoutResume.ts's pattern for the search-order checkout flow.
 */

export const VMC_STRIPE_SESSION_PARAM = 'vmc_stripe_session_id';

const CHAIN_UNLOCK_PENDING_KEY = 'propxchain.vmc.chain.pending';
// Pending state older than this is treated as abandoned and cleared, same
// TTL rationale as HMLR/search's pending-state.
const PENDING_STATE_TTL_MS = 24 * 60 * 60 * 1000;

export interface ChainUnlockPendingState {
  transactionId: string;
  startedAt: string;
  sessionId?: string;
}

export function saveChainUnlockPendingState(state: ChainUnlockPendingState): void {
  localStorage.setItem(CHAIN_UNLOCK_PENDING_KEY, JSON.stringify(state));
}

export function loadChainUnlockPendingState(): ChainUnlockPendingState | null {
  const raw = localStorage.getItem(CHAIN_UNLOCK_PENDING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ChainUnlockPendingState;
    const startedAtMs = Date.parse(parsed.startedAt);
    if (Number.isNaN(startedAtMs) || Date.now() - startedAtMs > PENDING_STATE_TTL_MS) {
      localStorage.removeItem(CHAIN_UNLOCK_PENDING_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(CHAIN_UNLOCK_PENDING_KEY);
    return null;
  }
}

export function clearChainUnlockPendingState(): void {
  localStorage.removeItem(CHAIN_UNLOCK_PENDING_KEY);
}
