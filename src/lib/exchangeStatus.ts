// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * What the client may see about exchange of contracts, read from the
 * transaction_manager record (icpService.getTransactionByTextId).
 *
 * Exchange is recorded by the two conveyancers in PropXchain Pro
 * (recordContractExchange): each side's conveyancer adds its confirmation,
 * and when both are on chain the canister sets status #exchanged and stamps
 * exchangedAt / contractExchangeTimestamp with Time.now() (nanoseconds).
 * This module only reads that record; the client never writes exchange.
 * The buyer's conveyancer's "deposit sent" and registration-application
 * records are separate canister reads: see lib/conveyancerRecords.ts.
 */
import { isAtLeastStatus, toTransactionStatus, TRANSACTION_STATUS_LABEL, type TransactionStatus } from '@/types/transactionStatus';

/** The fields of getTransactionByTextId's result this page reads. */
export interface ExchangeRecordInput {
  propertyAddress?: unknown;
  status?: unknown;
  completionDate?: unknown;
  buyerSolicitorSignature?: unknown;
  sellerSolicitorSignature?: unknown;
  exchangedAt?: unknown;
  contractExchangeTimestamp?: unknown;
}

export interface ExchangeStatus {
  propertyAddress: string | null;
  status: TransactionStatus;
  statusLabel: string;
  /** Contracts have exchanged (status is exchanged or later). */
  isExchanged: boolean;
  /** When the canister recorded exchange, or null if it has not. */
  exchangedAt: Date | null;
  /** The agreed completion date as stored on the deal, or null if none. */
  completionDate: string | null;
  buyerConveyancerConfirmed: boolean;
  sellerConveyancerConfirmed: boolean;
}

const NS_PER_MS = 1_000_000;

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** A canister Time (nanoseconds since epoch) as a Date; null for absent or zero. */
export function nanosToDate(value: unknown): Date | null {
  const n = typeof value === 'bigint' ? Number(value) : typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(Math.floor(n / NS_PER_MS));
}

/** Normalise the transaction record into what the exchange page shows. */
export function toExchangeStatus(tx: ExchangeRecordInput): ExchangeStatus {
  const status = toTransactionStatus(tx.status);
  return {
    propertyAddress: textOrNull(tx.propertyAddress),
    status,
    statusLabel: TRANSACTION_STATUS_LABEL[status],
    isExchanged: isAtLeastStatus(status, 'exchanged'),
    exchangedAt: nanosToDate(tx.exchangedAt) ?? nanosToDate(tx.contractExchangeTimestamp),
    completionDate: textOrNull(tx.completionDate),
    buyerConveyancerConfirmed: textOrNull(tx.buyerSolicitorSignature) !== null,
    sellerConveyancerConfirmed: textOrNull(tx.sellerSolicitorSignature) !== null,
  };
}

function longDate(at: Date): string {
  return at.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** The exchange row's value. */
export function exchangeText(s: ExchangeStatus): string {
  if (!s.isExchanged) return 'Not exchanged yet';
  return s.exchangedAt ? `Exchanged on ${longDate(s.exchangedAt)}` : 'Exchanged';
}

/** The completion date row's value; an unparseable stored date is shown as stored. */
export function completionDateText(s: ExchangeStatus): string {
  if (!s.completionDate) return 'Not recorded yet';
  const at = new Date(s.completionDate);
  return Number.isNaN(at.getTime()) ? s.completionDate : longDate(at);
}

/** A conveyancer confirmation row's value. */
export function confirmationText(isConfirmed: boolean): string {
  return isConfirmed ? 'Recorded on PropXchain' : 'Not recorded yet';
}
