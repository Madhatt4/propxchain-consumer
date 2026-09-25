// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import type { Transaction } from '../types/transaction.types';

/**
 * Which party the person looking at a transaction actually is.
 *
 * THE BUG THIS EXISTS TO PREVENT: the consumer dashboard used a bare
 * `isSeller` boolean, so everyone who was not the seller was treated as the
 * buyer. A conveyancer who joins a client's transaction with a code lands in
 * `tx.accessList` and legitimately appears on that dashboard — but they are
 * neither seller nor buyer, so they were told they owed Proof of Funds and a
 * Mortgage Agreement, and their "ready to sign" state was computed from
 * documents they will never upload. The same applied to every other
 * access-list party.
 *
 * 'other' means "present on this transaction, with no personal document
 * obligations in the consumer view" — not "unknown" and not "buyer".
 *
 * Deliberately a pure function in its own module rather than a local inside
 * DashboardPage: it is the piece that was wrong, so it is the piece worth
 * testing directly.
 */
export type ViewerRole = 'seller' | 'buyer' | 'other';

export function getViewerRole(
  tx: Transaction | null | undefined,
  principalId: string | null | undefined,
): ViewerRole {
  if (!tx || !principalId) return 'other';
  // createdBy counts as seller: the seller is whoever opened the transaction,
  // and tx.seller is not always populated on older records.
  if (tx.seller === principalId || tx.createdBy === principalId) return 'seller';
  if (tx.buyer === principalId) return 'buyer';
  return 'other';
}
