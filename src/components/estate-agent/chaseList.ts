// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The agent's chase list (stall attribution, spec
 * docs/plans/2026-09-05-stall-attribution-spec.md, surface 4): every live
 * sale, longest wait first, each with who owes the next move by role. Pure,
 * so the ordering is testable without a page.
 */
import { longestWait, type DealStall } from '@/services/stall.service';
import type { DealSide } from '@/services/shareParty.service';
import type { AgentListingRow } from '@/types/estateAgentListing.types';

export interface ChaseEntry {
  row: AgentListingRow;
  transactionId: string;
  /** The longest wait on the deal, or null when nothing is waiting. */
  wait: DealStall | null;
  /** The sides the agency currently acts for on this deal (spec R2.1: always shown). */
  actingFor: DealSide[];
  /** The soonest open next action from the chase log, or null. */
  nextDue: string | null;
  /** Whole days past the next action's due date; 0 when not overdue or none. */
  overdueDays: number;
}

/** What the agency's desk knows per deal beyond the stalls: mandates and open next actions. */
export interface DeskSignals {
  actingForByTx: Record<string, DealSide[]>;
  nextDueByTx: Record<string, string>;
}

export const EMPTY_DESK: DeskSignals = { actingForByTx: {}, nextDueByTx: {} };

function overdueDays(dueIso: string | null, nowIso: string): number {
  if (!dueIso) return 0;
  const ms = new Date(nowIso).getTime() - new Date(dueIso).getTime();
  return ms > 0 ? Math.floor(ms / 86_400_000) : 0;
}

/** The row's place on the desk: the longer of the stall and the overdue next action; nothing pending is -1. */
function urgency(e: ChaseEntry): number {
  return Math.max(e.wait?.days ?? -1, e.overdueDays > 0 ? e.overdueDays : -1);
}

/**
 * Live sales only (a listing has a transaction once a sale is started from
 * it), the most urgent first: an overdue next action counts like a stall of
 * the same length; sales with nothing pending keep listing order at the end.
 */
export function toChaseList(
  listings: readonly AgentListingRow[],
  stallsByTx: Record<string, DealStall[]>,
  desk: DeskSignals = EMPTY_DESK,
  nowIso: string = new Date().toISOString(),
): ChaseEntry[] {
  return listings
    .filter((row): row is AgentListingRow & { transaction_id: string } => !!row.transaction_id)
    .map((row, index) => {
      const nextDue = desk.nextDueByTx[row.transaction_id] ?? null;
      const entry: ChaseEntry = {
        row,
        transactionId: row.transaction_id,
        wait: longestWait(stallsByTx[row.transaction_id] ?? []),
        actingFor: desk.actingForByTx[row.transaction_id] ?? [],
        nextDue,
        overdueDays: overdueDays(nextDue, nowIso),
      };
      return { index, entry };
    })
    .sort((a, b) => {
      const byUrgency = urgency(b.entry) - urgency(a.entry);
      return byUrgency !== 0 ? byUrgency : a.index - b.index;
    })
    .map(({ entry }) => entry);
}

/** "3 live sales · 2 waiting on someone" / "1 live sale · nothing waiting"; while the stalls load, "… · checking who they are waiting on". */
export function describeChaseList(entries: readonly ChaseEntry[], isPending = false): string {
  const waiting = entries.filter((e) => e.wait).length;
  const sales = `${entries.length} live sale${entries.length === 1 ? '' : 's'}`;
  if (isPending) return `${sales} · checking who they are waiting on`;
  return waiting > 0 ? `${sales} · ${waiting} waiting on someone` : `${sales} · nothing waiting`;
}
