// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The small shared pieces of the support-ticket UI: the status pill, the
 * blocking flag and the "when" line. Shared by the ticket list and the ticket
 * thread so a status can never read one way on one screen and another way on
 * the next.
 *
 * Urgency is deliberately not rendered as a number. It is a triage score for
 * the support queue, not a promise to the user about response time, and 0-3 on
 * a card would read as one.
 */
import React from 'react';
import { statusLabel } from '../../services/supportTicket.service';

const STATUS_CLASSES: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  awaiting_user: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
  answered: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  closed: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

const PILL_BASE = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold';

export const TicketStatusPill: React.FC<{ status: string }> = ({ status }) => (
  <span className={`${PILL_BASE} ${STATUS_CLASSES[status] ?? STATUS_CLASSES.open}`}>{statusLabel(status)}</span>
);

/**
 * Shown only when the ticket blocks the move. Urgency on its own is a queue
 * ordering; "Blocking" is the one part of triage the user can act on.
 */
export const BlockingPill: React.FC = () => (
  <span className={`${PILL_BASE} bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200`}>Blocking</span>
);

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "3 hours ago" up to a week, then the date. Falls back to the raw string for
 * anything unparseable rather than rendering "Invalid Date".
 */
export function formatWhen(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return iso;
  const ago = now - then;
  if (ago < MINUTE) return 'just now';
  if (ago < HOUR) {
    const mins = Math.floor(ago / MINUTE);
    return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  }
  if (ago < DAY) {
    const hours = Math.floor(ago / HOUR);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (ago < 7 * DAY) {
    const days = Math.floor(ago / DAY);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
  return new Date(then).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
