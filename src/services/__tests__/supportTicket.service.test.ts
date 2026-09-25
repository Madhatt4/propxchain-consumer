// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

import {
  SupportTicketError,
  categoryLabel,
  closeTicket,
  createTicket,
  getTicket,
  listTickets,
  needsUserReply,
  replyToTicket,
  statusLabel,
  type SupportTicket,
} from '../supportTicket.service';

const TICKET: SupportTicket = {
  id: '11111111-2222-3333-4444-555555555555',
  user_id: 'user-1',
  email: 'buyer@example.com',
  name: 'Test Buyer',
  subject: 'TA6 form will not save',
  body: 'Topic: Forms\n\nIt spins forever on question 4.',
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
};

/** The shape supabase-js hands back for a non-2xx from an edge function. */
function invokeFailure(status: number, body: Record<string, unknown>): { data: null; error: unknown } {
  return {
    data: null,
    error: { message: 'Edge Function returned a non-2xx status code', context: { status, json: () => Promise.resolve(body) } },
  };
}

describe('supportTicket.service', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('should post the create action with only the context fields that are set', async () => {
    mockInvoke.mockResolvedValue({ data: { ticket: TICKET }, error: null });

    const ticket = await createTicket({ subject: 'TA6 form will not save', body: 'It spins forever.', pagePath: '/dashboard/support' });

    expect(mockInvoke).toHaveBeenCalledWith('support-ticket', {
      body: { action: 'create', subject: 'TA6 form will not save', body: 'It spins forever.', source: 'form', pagePath: '/dashboard/support' },
    });
    expect(ticket.id).toBe(TICKET.id);
  });

  it('should send transactionId and stage when the caller supplies them', async () => {
    mockInvoke.mockResolvedValue({ data: { ticket: TICKET }, error: null });

    await createTicket({ subject: 's', body: 'b', transactionId: 'TX-9', stage: 'pre_contract', source: 'chat' });

    expect(mockInvoke).toHaveBeenCalledWith('support-ticket', {
      body: { action: 'create', subject: 's', body: 'b', source: 'chat', transactionId: 'TX-9', stage: 'pre_contract' },
    });
  });

  it('should never send a name or an email: the function reads both off the session', async () => {
    mockInvoke.mockResolvedValue({ data: { ticket: TICKET }, error: null });

    await createTicket({ subject: 's', body: 'b' });

    const [, options] = mockInvoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(options.body).not.toHaveProperty('name');
    expect(options.body).not.toHaveProperty('email');
  });

  it('should return an empty list rather than undefined when the user has no tickets', async () => {
    mockInvoke.mockResolvedValue({ data: {}, error: null });

    await expect(listTickets()).resolves.toEqual([]);
    expect(mockInvoke).toHaveBeenCalledWith('support-ticket', { body: { action: 'list' } });
  });

  it('should return the ticket and its messages for get', async () => {
    mockInvoke.mockResolvedValue({ data: { ticket: TICKET, messages: [{ id: 'm1', ticket_id: TICKET.id, author: 'admin', body: 'Looking now.', created_at: 'x' }] }, error: null });

    const thread = await getTicket(TICKET.id);

    expect(mockInvoke).toHaveBeenCalledWith('support-ticket', { body: { action: 'get', id: TICKET.id } });
    expect(thread.messages).toHaveLength(1);
    expect(thread.ticket.subject).toBe(TICKET.subject);
  });

  it('should post a reply through the reply action, never a direct table write', async () => {
    mockInvoke.mockResolvedValue({ data: { message: { id: 'm2', ticket_id: TICKET.id, author: 'user', body: 'Still stuck.', created_at: 'x' } }, error: null });

    const message = await replyToTicket(TICKET.id, 'Still stuck.');

    expect(mockInvoke).toHaveBeenCalledWith('support-ticket', { body: { action: 'reply', id: TICKET.id, body: 'Still stuck.' } });
    expect(message.author).toBe('user');
  });

  it('should return the closed ticket from the close action', async () => {
    mockInvoke.mockResolvedValue({ data: { ticket: { ...TICKET, status: 'closed' } }, error: null });

    const closed = await closeTicket(TICKET.id);

    expect(mockInvoke).toHaveBeenCalledWith('support-ticket', { body: { action: 'close', id: TICKET.id } });
    expect(closed.status).toBe('closed');
  });

  it('should throw a SupportTicketError carrying the function error code on a non-2xx', async () => {
    mockInvoke.mockResolvedValue(invokeFailure(400, { error: 'invalid_subject' }));

    await expect(createTicket({ subject: '', body: 'b' })).rejects.toMatchObject({
      name: 'SupportTicketError',
      status: 400,
      code: 'invalid_subject',
    });
  });

  it('should carry resetIn through on a 429 so the UI can say how long to wait', async () => {
    mockInvoke.mockResolvedValue(invokeFailure(429, { error: 'rate_limited', resetIn: 42 }));

    await expect(listTickets()).rejects.toMatchObject({ status: 429, code: 'rate_limited', resetIn: 42 });
  });

  it('should fall back to the invoke message when the error body cannot be read', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'network down', context: { status: 0, json: () => Promise.reject(new Error('no body')) } },
    });

    await expect(getTicket(TICKET.id)).rejects.toMatchObject({ code: 'network down' });
  });

  it('should throw rather than return undefined when the function answers 200 with no body', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });

    await expect(getTicket(TICKET.id)).rejects.toBeInstanceOf(SupportTicketError);
  });

  it('should label every status in the user\'s terms and fall back to Open for an unknown one', () => {
    expect(statusLabel('open')).toBe('Open');
    expect(statusLabel('awaiting_user')).toBe('Awaiting your reply');
    expect(statusLabel('answered')).toBe('Answered');
    expect(statusLabel('closed')).toBe('Closed');
    expect(statusLabel('escalated_to_mars')).toBe('Open');
  });

  it('should label categories and fall back to Other for one added server-side later', () => {
    expect(categoryLabel('id_aml')).toBe('ID & AML');
    expect(categoryLabel('searches')).toBe('Searches');
    expect(categoryLabel('brand_new_category')).toBe('Other');
  });

  it('should flag only awaiting_user tickets as needing the user to reply', () => {
    expect(needsUserReply({ ...TICKET, status: 'awaiting_user' })).toBe(true);
    expect(needsUserReply({ ...TICKET, status: 'answered' })).toBe(false);
  });
});
