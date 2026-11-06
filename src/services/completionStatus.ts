// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Completion confirmations as transaction_manager records them: which side
 * has confirmed the completion money, whether that was the side's verified
 * conveyancer or only the client, and who confirmed keys released.
 *
 * The two methods are new in transaction_manager and are not yet in a
 * published @propxchain/core-client, so the Candid for just these two is
 * declared here (same approach as chainEntitlement.service and
 * logbook.service). Replace with core-client's transactionManagerIdl once a
 * release carries getCompletionStatus and confirmKeysReleased.
 */

import type { Actor } from '@propxchain/core-client';

// Built against the IDL namespace that core-client's Actor injects, so the
// factory type matches without casts (see logbook.service for why).
type CoreIdlFactory = Parameters<typeof Actor.createActor>[0];

export const completionIdlFactory: CoreIdlFactory = ({ IDL }) => {
  const SideConfirmation = IDL.Record({ at: IDL.Int, byConveyancer: IDL.Bool });
  const Status = IDL.Record({
    buyer: IDL.Opt(SideConfirmation),
    seller: IDL.Opt(SideConfirmation),
    conveyancerActing: IDL.Record({ buyer: IDL.Bool, seller: IDL.Bool }),
    keysReleased: IDL.Opt(IDL.Record({ at: IDL.Int, byAgent: IDL.Bool })),
    status: IDL.Text,
  });
  const Result = IDL.Variant({ ok: IDL.Text, err: IDL.Text });
  return IDL.Service({
    getCompletionStatus: IDL.Func([IDL.Text], [IDL.Opt(Status)], ['query']),
    confirmKeysReleased: IDL.Func([IDL.Text], [Result], []),
  });
};

interface RawSideConfirmation {
  at: bigint;
  byConveyancer: boolean;
}

export interface RawCompletionStatus {
  buyer: [] | [RawSideConfirmation];
  seller: [] | [RawSideConfirmation];
  conveyancerActing: { buyer: boolean; seller: boolean };
  keysReleased: [] | [{ at: bigint; byAgent: boolean }];
  status: string;
}

export interface CompletionActor {
  getCompletionStatus(transactionId: string): Promise<[] | [RawCompletionStatus]>;
  confirmKeysReleased(transactionId: string): Promise<{ ok: string } | { err: string }>;
}

export interface SideConfirmation {
  at: Date;
  byConveyancer: boolean;
}

export interface CompletionStatus {
  buyer: SideConfirmation | null;
  seller: SideConfirmation | null;
  /** A verified conveyancer is acting for the side on PropXchain. */
  conveyancerActing: { buyer: boolean; seller: boolean };
  keysReleased: { at: Date; byAgent: boolean } | null;
  /** transaction_manager's TransactionStatus as text, e.g. "exchanged". */
  status: string;
}

export type CompletionSide = 'buyer' | 'seller';

const COMPLETED_STATUSES: ReadonlySet<string> = new Set(['blockchain_completed', 'land_registry_registered']);

/** True once the canister says completion has happened. */
export function isCompletedStatus(status: string | null | undefined): boolean {
  return typeof status === 'string' && COMPLETED_STATUSES.has(status);
}

// Motoko Time.now() is nanoseconds since the epoch.
function fromNanos(at: bigint): Date {
  return new Date(Number(at / 1_000_000n));
}

function fromOpt<T>(value: [] | [T]): T | null {
  return value.length === 1 ? value[0] : null;
}

export function fromCandidCompletionStatus(raw: RawCompletionStatus): CompletionStatus {
  const side = (value: [] | [RawSideConfirmation]): SideConfirmation | null => {
    const c = fromOpt(value);
    return c ? { at: fromNanos(c.at), byConveyancer: c.byConveyancer } : null;
  };
  const keys = fromOpt(raw.keysReleased);
  return {
    buyer: side(raw.buyer),
    seller: side(raw.seller),
    conveyancerActing: { buyer: raw.conveyancerActing.buyer, seller: raw.conveyancerActing.seller },
    keysReleased: keys ? { at: fromNanos(keys.at), byAgent: keys.byAgent } : null,
    status: raw.status,
  };
}
