// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockListTickets = vi.fn();
vi.mock('../../services/supportTicket.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/supportTicket.service')>();
  return { ...actual, listTickets: (...args: unknown[]) => mockListTickets(...args) };
});

vi.mock('../../components/navigation/DashboardSidebar', () => ({ default: () => <nav data-testid="sidebar" /> }));
vi.mock('../../components/navigation/DashboardHeader', () => ({ default: () => <header data-testid="header" /> }));

import TicketListPage from '../../pages/support/TicketListPage';
import { formatWhen } from '../../components/support/TicketChrome';
import { useAuthStore } from '../../stores/authStore';
import type { SupportTicket } from '../../services/supportTicket.service';

function ticket(overrides: Partial<SupportTicket>): SupportTicket {
  return {
    id: 'id-1',
    user_id: 'user-1',
    email: 'buyer@example.com',
    name: 'Test Buyer',
    subject: 'A subject',
    body: 'A body',
    category: 'other',
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
    ...overrides,
  };
}

function renderPage(): void {
  render(
    <MemoryRouter initialEntries={['/dashboard/support/tickets']}>
      <TicketListPage />
    </MemoryRouter>,
  );
}

describe('TicketListPage', () => {
  beforeEach(() => {
    mockListTickets.mockReset().mockResolvedValue([]);
    useAuthStore.setState({ isAuthenticated: true, principalId: 'aaaaa-aa' });
  });

  it('should render one card per ticket, linked to its thread', async () => {
    mockListTickets.mockResolvedValue([
      ticket({ id: 'id-1', subject: 'Searches not back' }),
      ticket({ id: 'id-2', subject: 'Card declined' }),
    ]);
    renderPage();

    expect(await screen.findByText('Searches not back')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Card declined/ })).toHaveAttribute('href', '/dashboard/support/tickets/id-2');
  });

  it('should show the status in the user\'s terms, not the enum', async () => {
    mockListTickets.mockResolvedValue([ticket({ status: 'awaiting_user' })]);
    renderPage();

    expect(await screen.findByText('Awaiting your reply')).toBeInTheDocument();
    expect(screen.queryByText('awaiting_user')).not.toBeInTheDocument();
  });

  it('should show Blocking only when the ticket blocks the transaction, and never the urgency score', async () => {
    mockListTickets.mockResolvedValue([
      ticket({ id: 'id-1', subject: 'Blocking one', blocks_transaction: true, urgency: 3 }),
      ticket({ id: 'id-2', subject: 'Ordinary one', blocks_transaction: false, urgency: 1 }),
    ]);
    renderPage();

    await screen.findByText('Blocking one');
    expect(screen.getAllByText('Blocking')).toHaveLength(1);
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });

  it('should invite the user to raise one when they have no tickets', async () => {
    renderPage();

    expect(await screen.findByText(/No tickets yet/i)).toBeInTheDocument();
  });

  it('should offer a retry when the list cannot be loaded', async () => {
    mockListTickets.mockRejectedValueOnce(new Error('rate_limited')).mockResolvedValueOnce([ticket({ subject: 'Back again' })]);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Retry/i }));

    expect(await screen.findByText('Back again')).toBeInTheDocument();
    await waitFor(() => expect(mockListTickets).toHaveBeenCalledTimes(2));
  });
});

describe('formatWhen', () => {
  const now = Date.parse('2026-09-19T12:00:00Z');

  it('should read recent activity in relative terms', () => {
    expect(formatWhen('2026-09-19T11:59:30Z', now)).toBe('just now');
    expect(formatWhen('2026-09-19T11:59:00Z', now)).toBe('1 minute ago');
    expect(formatWhen('2026-09-19T11:00:00Z', now)).toBe('1 hour ago');
    expect(formatWhen('2026-09-17T12:00:00Z', now)).toBe('2 days ago');
  });

  it('should fall back to a date beyond a week, and to the raw value if unparseable', () => {
    expect(formatWhen('2026-08-01T12:00:00Z', now)).toBe('1 Aug 2026');
    expect(formatWhen('not a date', now)).toBe('not a date');
  });
});
