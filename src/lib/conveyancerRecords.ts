// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * What the buyer's conveyancer records on the deal in PropXchain Pro, read by
 * the parties (Madhatt4/Propxchain#422): "deposit sent" at exchange and the
 * registration application after completion. Records only: PropXchain never
 * holds or moves money and never lodges with HM Land Registry. Read through
 * icpService.getDepositSent / getRegistrationStatus.
 */

export interface DepositSent {
  /** YYYY-MM-DD, as the conveyancer gave it. */
  sentOn: string;
  amountPence: number | null;
}

export interface RegistrationStatus {
  /** Completion time in ms, or null before completion. */
  completedAt: number | null;
  awaitingApplication: boolean;
  submittedOn: string | null;
  applicationReference: string | null;
}

/** transaction_manager.getDepositSent's Candid result. */
export type CandidDepositSent = [] | [{
  depositSent: [] | [{ sentOn: string; recordedAt: bigint; amountPence: [] | [bigint] }];
}];

/** transaction_manager.getRegistrationStatus's Candid result. */
export type CandidRegistrationStatus = [] | [{
  completedAt: [] | [bigint];
  submittedOn: [] | [string];
  nextReminderAt: [] | [bigint];
  applicationReference: [] | [string];
  awaitingApplication: boolean;
  remindersDue: bigint;
}];

const NS_PER_MS = 1_000_000n;

function opt<T>(value: [] | [T]): T | null {
  return value.length === 1 ? value[0] : null;
}

/** Null when the deal is not found, the caller is not a member, or nothing is recorded. */
export function fromCandidDepositSent(raw: CandidDepositSent): DepositSent | null {
  const outer = opt(raw);
  const record = outer ? opt(outer.depositSent) : null;
  if (!record) return null;
  const pence = opt(record.amountPence);
  return { sentOn: record.sentOn, amountPence: pence === null ? null : Number(pence) };
}

/** Null when the deal is not found or the caller is not a member. */
export function fromCandidRegistrationStatus(raw: CandidRegistrationStatus): RegistrationStatus | null {
  const r = opt(raw);
  if (!r) return null;
  const completedNs = opt(r.completedAt);
  return {
    completedAt: completedNs === null ? null : Number(completedNs / NS_PER_MS),
    awaitingApplication: r.awaitingApplication,
    submittedOn: opt(r.submittedOn),
    applicationReference: opt(r.applicationReference),
  };
}

/** "2026-11-12" as "12 November 2026"; anything unparseable is shown as given. */
export function formatIsoDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const at = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return at.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function formatPence(pence: number): string {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** The deposit row's value. */
export function depositSentText(deposit: DepositSent | null): string {
  if (!deposit) return 'Not recorded yet';
  const when = formatIsoDate(deposit.sentOn);
  if (deposit.amountPence === null) return `Deposit sent by the buyer's conveyancer on ${when}`;
  return `Deposit of ${formatPence(deposit.amountPence)} sent by the buyer's conveyancer on ${when}`;
}

/** The registration row's value, or null before completion, when there is nothing to say. */
export function registrationText(status: RegistrationStatus | null): string | null {
  if (!status) return null;
  if (status.submittedOn) {
    const when = formatIsoDate(status.submittedOn);
    const ref = status.applicationReference ? `, ref ${status.applicationReference}` : '';
    return `Registration application submitted to HM Land Registry on ${when}${ref}`;
  }
  if (status.awaitingApplication || status.completedAt !== null) {
    return "Waiting for the buyer's conveyancer to submit the registration application";
  }
  return null;
}
