// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockGetTicket = vi.fn();
const mockReplyToTicket = vi.fn();
const mockCloseTicket = vi.fn();
vi.mock('../../services/supportTicket.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/supportTicket.service')>();
  return {
    ...actual,
    getTicket: (...args: unknown[]) => mockGetTicket(...args),
    replyToTicket: (...args: unknown[]) => mockReplyToTicket(...args),
    closeTicket: (...args: unknown[]) => mockCloseTicket(...args),
  };
});

vi.mock('../../components/navigation/DashboardSidebar', () => ({ default: () => <nav data-testid="sidebar" /> }));
vi.mock('../../components/navigation/DashboardHeader', () => ({ default: () => <header data-testid="header" /> }));

import TicketPage from '../../pages/support/TicketPage';
import { useAuthStore } from '../../stores/authStore';
import type { SupportTicket, SupportTicketMessage } from '../../services/supportTicket.service';

const TICKET_ID = '11111111-2222-3333-4444-555555555555';

const TICKET: SupportTicket = {
  id: TICKET_ID,
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
  status: 'answered',
  triage: null,
  source: 'form',
  created_at: '2026-09-19T09:00:00Z',
  updated_at: '2026-09-19T09:30:00Z',
  last_activity_at: '2026-09-19T09:30:00Z',
};

const MESSAGES: SupportTicketMessage[] = [
  { id: 'm1', ticket_id: TICKET_ID, author: 'bot', body: 'I could not answer that one.', created_at: '2026-09-19T09:05:00Z' },
  { id: 'm2', ticket_id: TICKET_ID, author: 'admin', body: 'Clearing the draft now.', created_at: '2026-09-19T09:30:00Z' },
];

function renderPage(): void {
  render(
    <MemoryRouter initialEntries={[`/dashboard/support/tickets/${TICKET_ID}`]}>
      <Routes>
        <Route path="/dashboard/support/tickets/:id" element={<TicketPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function typeReply(text: string): Promise<void> {
  const box = await screen.findByLabelText(/Your reply/i);
  fireEvent.change(box, { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: /Send reply/i }));
}

describe('TicketPage', () => {
  beforeEach(() => {
    mockGetTicket.mockReset().mockResolvedValue({ ticket: TICKET, messages: MESSAGES });
    mockReplyToTicket.mockReset().mockResolvedValue({ id: 'm3', ticket_id: TICKET_ID, author: 'user', body: 'Still stuck.', created_at: 'x' });
    mockCloseTicket.mockReset().mockResolvedValue({ ...TICKET, status: 'closed' });
    useAuthStore.setState({ isAuthenticated: true, principalId: 'aaaaa-aa' });
  });

  it('should render the subject, the status and the blocking flag', async () => {
    renderPage();

    expect(await screen.findByText('TA6 form will not save')).toBeInTheDocument();
    expect(mockGetTicket).toHaveBeenCalledWith(TICKET_ID);
    expect(screen.getByText('Answered')).toBeInTheDocument();
    expect(screen.getByText('Blocking')).toBeInTheDocument();
  });

  it('should open the thread with the ticket body, which is not a message row', async () => {
    renderPage();

    expect(await screen.findByText('It spins forever on question 4.')).toBeInTheDocument();
    expect(screen.getByText('Clearing the draft now.')).toBeInTheDocument();
    expect(screen.getByText('I could not answer that one.')).toBeInTheDocument();
  });

  it('should attribute each turn so the assistant never reads as a member of staff', async () => {
    renderPage();

    await screen.findByText('TA6 form will not save');
    expect(screen.getByText(/^You ·/)).toBeInTheDocument();
    expect(screen.getByText(/^PropXchain support ·/)).toBeInTheDocument();
    expect(screen.getByText(/^Assistant ·/)).toBeInTheDocument();
  });

  it('should post a reply through the reply action and re-read the thread', async () => {
    renderPage();
    await typeReply('Still stuck.');

    await waitFor(() => expect(mockReplyToTicket).toHaveBeenCalledWith(TICKET_ID, 'Still stuck.'));
    // Once on mount, once after the reply — the function reopens the ticket,
    // so the status on screen has to come back from the server.
    await waitFor(() => expect(mockGetTicket).toHaveBeenCalledTimes(2));
  });

  it('should trim the reply before sending it', async () => {
    renderPage();
    await typeReply('   Still stuck.   ');

    await waitFor(() => expect(mockReplyToTicket).toHaveBeenCalledWith(TICKET_ID, 'Still stuck.'));
  });

  it('should refuse to send an empty reply', async () => {
    renderPage();
    await typeReply('    ');

    expect(mockReplyToTicket).not.toHaveBeenCalled();
  });

  it('should tell the user when the reply did not send', async () => {
    mockReplyToTicket.mockRejectedValue(new Error('rate_limited'));
    renderPage();
    await typeReply('Still stuck.');

    expect(await screen.findByText(/reply was not sent/i)).toBeInTheDocument();
  });

  it('should close the ticket and swap the reply box for the closed notice', async () => {
    renderPage();
    const close = await screen.findByRole('button', { name: /Close this ticket/i });
    fireEvent.click(close);

    await waitFor(() => expect(mockCloseTicket).toHaveBeenCalledWith(TICKET_ID));
    expect(await screen.findByText(/This ticket is closed/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Your reply/i)).not.toBeInTheDocument();
  });

  it('should surface a ticket that is not the caller\'s as an error, not an empty page', async () => {
    mockGetTicket.mockRejectedValue(new Error('forbidden'));
    renderPage();

    expect(await screen.findByText(/could not load this ticket/i)).toBeInTheDocument();
  });
});
