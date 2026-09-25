// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Which tickets the support desk shows and in what order. Pure, so the
 * filtering rules are testable without rendering the desk.
 *
 * The function's `list` action filters on one status at a time, but the desk
 * opens on two (Open and Awaiting user) and lets several be held at once. So
 * the desk reads the queue whole and narrows it here: chips then become
 * instant, and switching filters costs nothing.
 */
import { TICKET_STATUSES, type TicketStatus } from '../../../services/supportTicket.service';
import type { AdminTicketSummary } from '../../../services/supportAdmin.service';

export interface QueueFilter {
  id: TicketStatus;
  label: string;
}

/** Chips in queue order: the ones with work in them first. */
export const QUEUE_FILTERS: readonly QueueFilter[] = Object.freeze([
  { id: 'open', label: 'Open' },
  { id: 'awaiting_user', label: 'Awaiting user' },
  { id: 'answered', label: 'Answered' },
  { id: 'closed', label: 'Closed' },
]);

/** What the desk opens on: everything still waiting on somebody. */
export const DEFAULT_QUEUE_FILTERS: readonly TicketStatus[] = Object.freeze(['open', 'awaiting_user']);

export const ALL_QUEUE_FILTERS: readonly TicketStatus[] = Object.freeze([...TICKET_STATUSES]);

/**
 * Add or remove one status. Removing the last one is refused: an empty
 * selection is a blank screen that looks like a failed load, and no click
 * should be able to produce one.
 */
export function toggleQueueFilter(selected: readonly TicketStatus[], status: TicketStatus): TicketStatus[] {
  if (!selected.includes(status)) return [...selected, status];
  if (selected.length === 1) return [...selected];
  return selected.filter((s) => s !== status);
}

/** True when every status is showing, which is what lights the All chip. */
export function isShowingAll(selected: readonly TicketStatus[]): boolean {
  return ALL_QUEUE_FILTERS.every((status) => selected.includes(status));
}

/**
 * Most urgent first, then whatever moved most recently — the function's own
 * ordering, reapplied because filtering a list does not re-sort it and a row
 * whose status has just changed has moved in the queue.
 */
export function sortQueue(tickets: readonly AdminTicketSummary[]): AdminTicketSummary[] {
  return [...tickets].sort((a, b) => {
    if (b.urgency !== a.urgency) return b.urgency - a.urgency;
    return Date.parse(b.last_activity_at) - Date.parse(a.last_activity_at);
  });
}

/** The rows for the selected chips, in queue order. */
export function filterQueue(
  tickets: readonly AdminTicketSummary[],
  selected: readonly TicketStatus[],
): AdminTicketSummary[] {
  return sortQueue(tickets.filter((ticket) => selected.includes(ticket.status as TicketStatus)));
}

/**
 * The badge on the nav link. Only `open` counts: `awaiting_user` is a ticket
 * the customer owes us an answer on, so it is not work sitting on the desk.
 */
export function openTicketCount(tickets: readonly AdminTicketSummary[]): number {
  return tickets.filter((ticket) => ticket.status === 'open').length;
}

/** Replaces one row in place, leaving the rest of the queue as it was. */
export function replaceTicket(
  tickets: readonly AdminTicketSummary[],
  updated: Pick<AdminTicketSummary, 'id'> & Partial<AdminTicketSummary>,
): AdminTicketSummary[] {
  return tickets.map((ticket) => (ticket.id === updated.id ? { ...ticket, ...updated } : ticket));
}
