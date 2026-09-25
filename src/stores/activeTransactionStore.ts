// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Which deal the user is looking at right now, readable from anywhere.
 *
 * The dashboard already knows this, but it knows it in component state inside
 * `SplitPanelProvider`, which only wraps the premium dashboard. Anything
 * mounted above that provider — the support chat widget is the first such
 * thing — cannot see it, and wrapping the whole app in the provider would
 * start its transaction fetch and document polling on every route.
 *
 * So the dashboard publishes here and readers subscribe. Deliberately narrow:
 * an id and a stage, no transaction object, no loading state and nothing
 * fetched. It is a pointer to state that lives elsewhere, not a second copy of
 * it, and it holds no personal data.
 *
 * Not persisted. "What am I looking at" is true for as long as the page is
 * open and a stale answer after a reload would be worse than none.
 */
import { create } from 'zustand';
import type { TransactionStatus } from '../types/transactionStatus';

/** The shape a publisher hands over: the fields any reader actually needs. */
export interface ActiveTransaction {
  id: string;
  status: TransactionStatus;
}

interface ActiveTransactionState {
  transactionId: string | null;
  stage: TransactionStatus | null;
  /** Publish, or pass null to clear on unmount or when the user goes back to a list. */
  setActiveTransaction: (transaction: ActiveTransaction | null) => void;
}

export const useActiveTransactionStore = create<ActiveTransactionState>((set) => ({
  transactionId: null,
  stage: null,
  setActiveTransaction: (transaction) =>
    set({ transactionId: transaction?.id ?? null, stage: transaction?.status ?? null }),
}));
