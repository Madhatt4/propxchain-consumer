// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * The transaction status vocabulary, exactly as transaction_manager's Candid
 * `TransactionStatus` variant defines it (PDTF adapter plan, PR 10 narrow).
 *
 * The consumer used to carry thirteen values of which eight never existed on
 * chain ('draft', 'document-collection', 'searches', 'contract-prep',
 * 'exchange', 'completion', 'completed', 'cancelled'). Code comparing against
 * them was silently never true: "active" counts included every completed
 * deal, and the conveyancer's Confirm-exchange button could never enable.
 * Everything now goes through this one list. A cancelled deal is not a
 * status on chain but `oldStatus === 'cancelled'`; read that field, never
 * this union, for cancellation.
 */

export const TRANSACTION_STATUSES = [
  'active',
  'exchanged',
  'completion_initiated',
  'blockchain_completed',
  'land_registry_registered',
] as const;

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const TRANSACTION_STATUS_LABEL: Record<TransactionStatus, string> = {
  active: 'Active',
  exchanged: 'Exchanged',
  completion_initiated: 'Completing',
  blockchain_completed: 'Completed',
  land_registry_registered: 'Registered',
};

export function isTransactionStatus(value: unknown): value is TransactionStatus {
  return typeof value === 'string' && (TRANSACTION_STATUSES as readonly string[]).includes(value);
}

/**
 * A status as the canister returns it (a Candid variant such as
 * `{ active: null }`) or as a string, normalised to the union. Anything
 * unrecognised is 'active': every deal that exists is at least active, and a
 * wrong guess forward would claim progress that has not happened.
 */
export function toTransactionStatus(raw: unknown): TransactionStatus {
  if (isTransactionStatus(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const key = Object.keys(raw)[0];
    if (isTransactionStatus(key)) return key;
  }
  // A value this module does not know is canister drift, not data: say so
  // rather than let a new variant quietly read as an open deal.
  if (raw !== undefined && raw !== null && import.meta.env?.DEV) {
    console.warn('[transactionStatus] unknown status, treating as active:', raw);
  }
  return 'active';
}

/** True from exchange onwards, so "exchanged or later". */
export function isAtLeastStatus(status: string | null | undefined, floor: TransactionStatus): boolean {
  const order = TRANSACTION_STATUSES as readonly string[];
  const idx = order.indexOf(status ?? '');
  return idx >= 0 && idx >= order.indexOf(floor);
}

/** Completion has been recorded (on chain, then with HM Land Registry). */
export function isCompletedStatus(status: string | null | undefined): boolean {
  return status === 'blockchain_completed' || status === 'land_registry_registered';
}

/** Contracts have exchanged and completion has not yet been recorded. */
export function isExchangedStatus(status: string | null | undefined): boolean {
  return status === 'exchanged' || status === 'completion_initiated';
}

/** Progress, 0 to 100, from status alone. Detail pages refine 'active' from document uploads. */
export const TRANSACTION_STATUS_PROGRESS: Record<TransactionStatus, number> = {
  active: 10,
  exchanged: 80,
  completion_initiated: 90,
  blockchain_completed: 95,
  land_registry_registered: 100,
};
