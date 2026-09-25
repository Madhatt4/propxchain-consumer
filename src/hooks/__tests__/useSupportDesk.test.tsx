// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const listAdminTickets = vi.fn();
const getAdminTicket = vi.fn();
const replyToAdminTicket = vi.fn();
const setTicketStatus = vi.fn();

vi.mock('../../services/supportAdmin.service', async () => {
  const actual = await vi.importActual<typeof import('../../services/supportAdmin.service')>(
    '../../services/supportAdmin.service',
  );
  return {
    ...actual,
    listAdminTickets: (...args: unknown[]) => listAdminTickets(...args),
    getAdminTicket: (...args: unknown[]) => getAdminTicket(...args),
    replyToAdminTicket: (...args: unknown[]) => replyToAdminTicket(...args),
    setTicketStatus: (...args: unknown[]) => setTicketStatus(...args),
  };
});

import { SupportAdminError, type AdminTicketSummary } from '../../services/supportAdmin.service';
import { useSupportDesk } from '../useSupportDesk';

function ticket(over: Partial<AdminTicketSummary> & { id: string }): AdminTicketSummary {
  return {
    user_id: 'user-1',
    email: 'buyer@example.com',
    name: 'Test Buyer',
    subject: 'Subject',
    body: 'Body',
    category: 'forms',
    urgency: 1,
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

const OPEN = ticket({ id: 'aaa', subject: 'Cannot pay', status: 'open' });
const CLOSED = ticket({ id: 'bbb', subject: 'Old one', status: 'closed' });

async function mounted() {
  const hook = renderHook(() => useSupportDesk(true));
  await waitFor(() => expect(hook.result.current.isQueueLoading).toBe(false));
  return hook;
}

async function withSelection() {
  const hook = await mounted();
  act(() => hook.result.current.select('aaa'));
  await waitFor(() => expect(hook.result.current.ticket).not.toBeNull());
  return hook;
}

describe('useSupportDesk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listAdminTickets.mockResolvedValue([OPEN, CLOSED]);
    getAdminTicket.mockResolvedValue({ ticket: OPEN, messages: [] });
    replyToAdminTicket.mockResolvedValue({
      message: { id: 'm1', ticket_id: 'aaa', author: 'admin', body: 'Sorted.', created_at: '2026-09-20T10:00:00Z' },
      status: 'awaiting_user',
    });
    setTicketStatus.mockResolvedValue({ ...OPEN, status: 'closed' });
  });

  it('should not read the queue until the caller says the admin gate has passed', () => {
    renderHook(() => useSupportDesk(false));

    expect(listAdminTickets).not.toHaveBeenCalled();
  });

  it('should read the whole queue once and narrow it to the default filters', async () => {
    const { result } = await mounted();

    expect(listAdminTickets).toHaveBeenCalledTimes(1);
    expect(result.current.tickets).toHaveLength(2);
    expect(result.current.visibleTickets.map((t) => t.id)).toEqual(['aaa']);
    expect(result.current.openCount).toBe(1);
  });

  it('should show the closed ticket once every chip is on', async () => {
    const { result } = await mounted();

    act(() => result.current.showAll());

    expect(result.current.visibleTickets.map((t) => t.id)).toEqual(['aaa', 'bbb']);
  });

  it('should narrow to one status when a chip is switched off', async () => {
    const { result } = await mounted();

    act(() => result.current.toggleFilter('awaiting_user'));

    expect(result.current.filters).toEqual(['open']);
  });

  it('should load the thread for the selected ticket', async () => {
    const { result } = await withSelection();

    expect(getAdminTicket).toHaveBeenCalledWith('aaa');
    expect(result.current.ticket?.subject).toBe('Cannot pay');
  });

  it('should post a reply through the service and append the stored message', async () => {
    const { result } = await withSelection();

    await act(async () => {
      await result.current.reply('Sorted.');
    });

    expect(replyToAdminTicket).toHaveBeenCalledWith('aaa', 'Sorted.');
    expect(result.current.messages.map((m) => m.body)).toEqual(['Sorted.']);
  });

  it('should move the replied ticket to the status the function parked it in, in the queue too', async () => {
    const { result } = await withSelection();

    await act(async () => {
      await result.current.reply('Sorted.');
    });

    expect(result.current.ticket?.status).toBe('awaiting_user');
    expect(result.current.tickets.find((t) => t.id === 'aaa')?.status).toBe('awaiting_user');
    expect(result.current.tickets.find((t) => t.id === 'aaa')?.last_activity_at).toBe('2026-09-20T10:00:00Z');
  });

  it('should never re-read the queue to reflect a reply', async () => {
    const { result } = await withSelection();

    await act(async () => {
      await result.current.reply('Sorted.');
    });

    expect(listAdminTickets).toHaveBeenCalledTimes(1);
  });

  it('should rethrow a failed reply so the draft is kept, and say what went wrong', async () => {
    replyToAdminTicket.mockRejectedValue(new SupportAdminError(429, 'rate_limited', 30));
    const { result } = await withSelection();

    await act(async () => {
      await expect(result.current.reply('Sorted.')).rejects.toBeInstanceOf(SupportAdminError);
    });

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.error).toMatch(/too many requests/i);
  });

  it('should call set_status and apply the returned ticket to the thread and the queue', async () => {
    const { result } = await withSelection();

    await act(async () => {
      await result.current.changeStatus('closed');
    });

    expect(setTicketStatus).toHaveBeenCalledWith('aaa', 'closed');
    expect(result.current.ticket?.status).toBe('closed');
    expect(result.current.tickets.find((t) => t.id === 'aaa')?.status).toBe('closed');
  });

  it('should keep a failed status change quiet in the queue but tell the admin', async () => {
    setTicketStatus.mockRejectedValue(new SupportAdminError(404, 'not_found'));
    const { result } = await withSelection();

    await act(async () => {
      await result.current.changeStatus('closed');
    });

    expect(result.current.tickets.find((t) => t.id === 'aaa')?.status).toBe('open');
    expect(result.current.error).toMatch(/no longer exists/i);
  });

  it('should flag a 403 as the account not being on the desk list', async () => {
    listAdminTickets.mockRejectedValue(new SupportAdminError(403, 'forbidden'));
    const { result } = await mounted();

    expect(result.current.isForbidden).toBe(true);
    expect(result.current.error).toMatch(/not on the support desk admin list/i);
    expect(result.current.tickets).toEqual([]);
  });

  it('should clear the open thread when the selection is dropped', async () => {
    const { result } = await withSelection();

    act(() => result.current.select(null));

    expect(result.current.selectedId).toBeNull();
    expect(result.current.ticket).toBeNull();
    expect(result.current.messages).toEqual([]);
  });
});
