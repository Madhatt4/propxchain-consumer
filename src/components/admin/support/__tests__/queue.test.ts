// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect } from 'vitest';
import type { AdminTicketSummary } from '../../../../services/supportAdmin.service';
import type { TicketStatus } from '../../../../services/supportTicket.service';
import {
  ALL_QUEUE_FILTERS,
  DEFAULT_QUEUE_FILTERS,
  QUEUE_FILTERS,
  filterQueue,
  isShowingAll,
  openTicketCount,
  replaceTicket,
  sortQueue,
  toggleQueueFilter,
} from '../queue';

function ticket(over: Partial<AdminTicketSummary> & { id: string }): AdminTicketSummary {
  return {
    user_id: 'user-1',
    email: 'buyer@example.com',
    name: 'Test Buyer',
    subject: 'Subject',
    body: 'Body',
    category: 'forms',
    urgency: 0,
    blocks_transaction: false,
    transaction_id: null,
    page_path: null,
    stage: null,
    status: 'open',
    triage: null,
    source: 'form',
    created_at: '2026-09-19T09:00:00Z',
    updated_at: '2026-09-19T09:00:00Z',
    last_activity_at: '2026-09-19T09:00:00Z',
    message_count: 0,
    ...over,
  };
}

const QUEUE: AdminTicketSummary[] = [
  ticket({ id: 'a', status: 'open', urgency: 1, last_activity_at: '2026-09-19T12:00:00Z' }),
  ticket({ id: 'b', status: 'awaiting_user', urgency: 3, last_activity_at: '2026-09-19T08:00:00Z' }),
  ticket({ id: 'c', status: 'closed', urgency: 3, last_activity_at: '2026-09-19T10:00:00Z' }),
  ticket({ id: 'd', status: 'answered', urgency: 0, last_activity_at: '2026-09-19T13:00:00Z' }),
  ticket({ id: 'e', status: 'open', urgency: 1, last_activity_at: '2026-09-19T07:00:00Z' }),
];

describe('support desk queue', () => {
  it('should offer one chip per status, in the order work arrives in', () => {
    expect(QUEUE_FILTERS.map((f) => f.id)).toEqual(['open', 'awaiting_user', 'answered', 'closed']);
  });

  it('should open on the two statuses that are still waiting on somebody', () => {
    expect([...DEFAULT_QUEUE_FILTERS]).toEqual(['open', 'awaiting_user']);
  });

  it('should sort most urgent first, then most recently active', () => {
    expect(sortQueue(QUEUE).map((t) => t.id)).toEqual(['c', 'b', 'a', 'e', 'd']);
  });

  it('should show only the selected statuses, still in queue order', () => {
    expect(filterQueue(QUEUE, ['open']).map((t) => t.id)).toEqual(['a', 'e']);
    expect(filterQueue(QUEUE, ['open', 'awaiting_user']).map((t) => t.id)).toEqual(['b', 'a', 'e']);
  });

  it('should show the whole queue when every chip is on', () => {
    expect(filterQueue(QUEUE, ALL_QUEUE_FILTERS)).toHaveLength(QUEUE.length);
  });

  it('should add a status that is off and remove one that is on', () => {
    expect(toggleQueueFilter(['open'], 'closed')).toEqual(['open', 'closed']);
    expect(toggleQueueFilter(['open', 'closed'], 'closed')).toEqual(['open']);
  });

  it('should refuse to turn off the last chip, which would blank the queue', () => {
    expect(toggleQueueFilter(['open'], 'open')).toEqual(['open']);
  });

  it('should light the All chip only when every status is showing', () => {
    expect(isShowingAll(['open', 'awaiting_user'])).toBe(false);
    expect(isShowingAll(ALL_QUEUE_FILTERS)).toBe(true);
  });

  it('should count only open tickets for the badge, never ones waiting on the customer', () => {
    expect(openTicketCount(QUEUE)).toBe(2);
    expect(openTicketCount([])).toBe(0);
  });

  it('should patch one row and leave every other row untouched', () => {
    const patched = replaceTicket(QUEUE, { id: 'a', status: 'closed' as TicketStatus });

    expect(patched.find((t) => t.id === 'a')?.status).toBe('closed');
    expect(patched.find((t) => t.id === 'b')).toEqual(QUEUE.find((t) => t.id === 'b'));
    expect(patched).toHaveLength(QUEUE.length);
  });

  it('should leave the queue alone when the patched ticket is not in it', () => {
    expect(replaceTicket(QUEUE, { id: 'missing', status: 'closed' as TicketStatus })).toEqual(QUEUE);
  });
});
