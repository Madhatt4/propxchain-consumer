// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Turning a ticket and its messages into the turns of a conversation. Shared
 * by the customer's ticket screen and the admin support desk so the two can
 * never disagree about what was said or in what order.
 *
 * The opening turn is the ticket's own `body`, not a row in
 * `support_ticket_messages` — the create action stores it on the ticket. A
 * thread built only from the messages table starts halfway through.
 */
import type { SupportTicket, SupportTicketMessage } from '../../services/supportTicket.service';

export interface TicketBubble {
  key: string;
  author: string;
  body: string;
  created_at: string;
}

export function toThread(ticket: SupportTicket, messages: readonly SupportTicketMessage[]): TicketBubble[] {
  const opening: TicketBubble = {
    key: `ticket-${ticket.id}`,
    author: 'user',
    body: ticket.body,
    created_at: ticket.created_at,
  };
  return [opening, ...messages.map((m) => ({ key: m.id, author: m.author, body: m.body, created_at: m.created_at }))];
}

/** What the customer's own ticket screen calls each author. */
export const CUSTOMER_AUTHOR_LABELS: Readonly<Record<string, string>> = Object.freeze({
  user: 'You',
  admin: 'PropXchain support',
  bot: 'Assistant',
});

/** What the support desk calls each author. */
export const ADMIN_AUTHOR_LABELS: Readonly<Record<string, string>> = Object.freeze({
  user: 'Customer',
  admin: 'PropXchain support',
  bot: 'Assistant',
});
