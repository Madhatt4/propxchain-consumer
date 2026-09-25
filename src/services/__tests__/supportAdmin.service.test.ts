// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  SupportAdminError,
  getAdminTicket,
  listAdminTickets,
  replyToAdminTicket,
  setTicketStatus,
  type AdminTicketSummary,
} from '../supportAdmin.service';

const TICKET: AdminTicketSummary = {
  id: '11111111-2222-3333-4444-555555555555',
  user_id: 'user-1',
  email: 'buyer@example.com',
  name: 'Test Buyer',
  subject: 'TA6 form will not save',
  body: 'It spins forever on question 4.',
  category: 'forms',
  urgency: 2,
  blocks_transaction: true,
  transaction_id: 'TX-9',
  page_path: '/transaction/TX-9/forms/ta6',
  stage: 'pre_contract',
  status: 'open',
  triage: null,
  source: 'form',
  created_at: '2026-09-19T09:00:00Z',
  updated_at: '2026-09-19T09:00:00Z',
  last_activity_at: '2026-09-19T09:00:00Z',
  message_count: 2,
};

/** The shape supabase-js hands back for a non-2xx from an edge function. */
function invokeFailure(status: number, body: Record<string, unknown>): { data: null; error: unknown } {
  return {
    data: null,
    error: {
      message: 'Edge Function returned a non-2xx status code',
      context: { status, json: () => Promise.resolve(body) },
    },
  };
}

describe('supportAdmin.service', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('should list every status by default so the desk can filter on more than one', async () => {
    mockInvoke.mockResolvedValue({ data: { tickets: [TICKET] }, error: null });

    const tickets = await listAdminTickets();

    expect(mockInvoke).toHaveBeenCalledWith('support-admin', {
      body: { action: 'list', limit: DEFAULT_LIST_LIMIT },
    });
    const [, options] = mockInvoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(options.body).not.toHaveProperty('status');
    expect(tickets).toHaveLength(1);
    expect(tickets[0].message_count).toBe(2);
  });

  it('should pass a status and limit through when the caller narrows the read', async () => {
    mockInvoke.mockResolvedValue({ data: { tickets: [] }, error: null });

    await listAdminTickets({ status: 'open', limit: MAX_LIST_LIMIT });

    expect(mockInvoke).toHaveBeenCalledWith('support-admin', {
      body: { action: 'list', limit: MAX_LIST_LIMIT, status: 'open' },
    });
  });

  it('should return an empty queue rather than undefined when nothing is waiting', async () => {
    mockInvoke.mockResolvedValue({ data: {}, error: null });

    await expect(listAdminTickets()).resolves.toEqual([]);
  });

  it('should return the ticket and its messages for get', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ticket: TICKET,
        messages: [{ id: 'm1', ticket_id: TICKET.id, author: 'user', body: 'Still stuck.', created_at: 'x' }],
      },
      error: null,
    });

    const thread = await getAdminTicket(TICKET.id);

    expect(mockInvoke).toHaveBeenCalledWith('support-admin', { body: { action: 'get', id: TICKET.id } });
    expect(thread.ticket.subject).toBe(TICKET.subject);
    expect(thread.messages).toHaveLength(1);
  });

  it('should default a get with no messages to an empty thread', async () => {
    mockInvoke.mockResolvedValue({ data: { ticket: TICKET }, error: null });

    await expect(getAdminTicket(TICKET.id)).resolves.toMatchObject({ messages: [] });
  });

  it('should post a reply through the reply action and return the status it parked the ticket in', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        message: { id: 'm2', ticket_id: TICKET.id, author: 'admin', body: 'Fixed now.', created_at: 'y' },
        status: 'awaiting_user',
      },
      error: null,
    });

    const result = await replyToAdminTicket(TICKET.id, 'Fixed now.');

    expect(mockInvoke).toHaveBeenCalledWith('support-admin', {
      body: { action: 'reply', id: TICKET.id, body: 'Fixed now.' },
    });
    expect(result.message.author).toBe('admin');
    expect(result.status).toBe('awaiting_user');
  });

  it('should assume awaiting_user when a reply comes back without a status', async () => {
    mockInvoke.mockResolvedValue({
      data: { message: { id: 'm3', ticket_id: TICKET.id, author: 'admin', body: 'b', created_at: 'y' } },
      error: null,
    });

    await expect(replyToAdminTicket(TICKET.id, 'b')).resolves.toMatchObject({ status: 'awaiting_user' });
  });

  it('should move a ticket through set_status and return the moved ticket', async () => {
    mockInvoke.mockResolvedValue({ data: { ticket: { ...TICKET, status: 'closed' } }, error: null });

    const closed = await setTicketStatus(TICKET.id, 'closed');

    expect(mockInvoke).toHaveBeenCalledWith('support-admin', {
      body: { action: 'set_status', id: TICKET.id, status: 'closed' },
    });
    expect(closed.status).toBe('closed');
  });

  it('should throw a SupportAdminError carrying forbidden when the caller is not an admin', async () => {
    mockInvoke.mockResolvedValue(invokeFailure(403, { error: 'forbidden' }));

    await expect(listAdminTickets()).rejects.toMatchObject({
      name: 'SupportAdminError',
      status: 403,
      code: 'forbidden',
    });
  });

  it('should throw forbidden on every action, not only the read', async () => {
    mockInvoke.mockResolvedValue(invokeFailure(403, { error: 'forbidden' }));

    await expect(getAdminTicket(TICKET.id)).rejects.toMatchObject({ status: 403, code: 'forbidden' });
    await expect(replyToAdminTicket(TICKET.id, 'hello')).rejects.toMatchObject({ status: 403, code: 'forbidden' });
    await expect(setTicketStatus(TICKET.id, 'closed')).rejects.toMatchObject({ status: 403, code: 'forbidden' });
  });

  it('should carry resetIn through on a 429 so the desk can say how long to wait', async () => {
    mockInvoke.mockResolvedValue(invokeFailure(429, { error: 'rate_limited', resetIn: 42 }));

    await expect(listAdminTickets()).rejects.toMatchObject({ status: 429, code: 'rate_limited', resetIn: 42 });
  });

  it('should fall back to the invoke message when the error body cannot be read', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'network down', context: { status: 0, json: () => Promise.reject(new Error('no body')) } },
    });

    await expect(getAdminTicket(TICKET.id)).rejects.toMatchObject({ code: 'network down' });
  });

  it('should throw rather than return undefined when the function answers 200 with no body', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });

    await expect(getAdminTicket(TICKET.id)).rejects.toBeInstanceOf(SupportAdminError);
  });
});
