// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The desk's own gate. The function is the real authority — it answers 403 to
 * anyone not on its list — so these cover the screen, not the data: a
 * non-admin is sent away and never renders the queue, and an admin whose
 * account is missing from the function's list is told exactly that instead of
 * staring at an empty desk.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/components/navigation/AppTopBar', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <header>{title}</header>,
  AppTopBar: ({ title }: { title: string }) => <header>{title}</header>,
}));

const useIsAdmin = vi.fn();
vi.mock('../../../hooks/useIsAdmin', () => ({ useIsAdmin: () => useIsAdmin() }));

vi.mock('../../../stores/authStore', () => ({ usePrincipalId: () => 'aaaaa-aa' }));

vi.mock('../../../constants/adminPrincipals', () => ({ isAdminPrincipal: () => false }));

const listAdminTickets = vi.fn();
const getAdminTicket = vi.fn();
vi.mock('../../../services/supportAdmin.service', async () => {
  const actual = await vi.importActual<typeof import('../../../services/supportAdmin.service')>(
    '../../../services/supportAdmin.service',
  );
  return {
    ...actual,
    listAdminTickets: (...args: unknown[]) => listAdminTickets(...args),
    getAdminTicket: (...args: unknown[]) => getAdminTicket(...args),
    replyToAdminTicket: vi.fn(),
    setTicketStatus: vi.fn(),
  };
});

import { SupportAdminError, type AdminTicketSummary } from '../../../services/supportAdmin.service';
import SupportDeskPage from '../SupportDeskPage';

const TICKET: AdminTicketSummary = {
  id: '11111111-2222-3333-4444-555555555555',
  user_id: 'user-1',
  email: 'buyer@example.com',
  name: 'Test Buyer',
  subject: 'Cannot pay for searches',
  body: 'The card form will not submit.',
  category: 'payments',
  urgency: 3,
  blocks_transaction: true,
  transaction_id: 'TX-9',
  page_path: '/transaction/TX-9/searches',
  stage: 'pre_contract',
  status: 'open',
  triage: {
    category: { kind: 'choice', choice: 'payments', probabilities: { payments: 0.9 } },
    urgency: { kind: 'score', score: 3 },
    blocks_transaction: { kind: 'noul', probability: 0.82 },
    is_bug: { kind: 'noul', probability: 0.4 },
    answerable_from_help: { kind: 'noul', probability: 0.1 },
  },
  source: 'form',
  created_at: '2026-09-19T09:00:00Z',
  updated_at: '2026-09-19T09:00:00Z',
  last_activity_at: '2026-09-19T09:00:00Z',
  message_count: 0,
};

function renderDesk(): void {
  render(
    <MemoryRouter>
      <SupportDeskPage />
    </MemoryRouter>,
  );
}

describe('SupportDeskPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listAdminTickets.mockResolvedValue([TICKET]);
    getAdminTicket.mockResolvedValue({ ticket: TICKET, messages: [] });
    useIsAdmin.mockReturnValue({ isAdmin: true, role: 'super', isLoading: false });
  });

  it('should send a non-admin to the dashboard and render no desk at all', async () => {
    useIsAdmin.mockReturnValue({ isAdmin: false, role: null, isLoading: false });

    renderDesk();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
    expect(screen.queryByRole('heading', { name: /support desk/i })).not.toBeInTheDocument();
    expect(listAdminTickets).not.toHaveBeenCalled();
  });

  it('should not send anyone away while the admin check is still running', () => {
    useIsAdmin.mockReturnValue({ isAdmin: false, role: null, isLoading: true });

    renderDesk();

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should show the queue to an admin', async () => {
    renderDesk();

    expect(await screen.findByRole('button', { name: /Cannot pay for searches/ })).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should open the ticket with its triage and the address a reply will go to', async () => {
    renderDesk();

    fireEvent.click(await screen.findByRole('button', { name: /Cannot pay for searches/ }));

    expect(await screen.findByRole('heading', { name: 'Cannot pay for searches' })).toBeInTheDocument();
    expect(screen.getByText('Payments · 90%')).toBeInTheDocument();
    expect(screen.getByText('3/3 · Money or a deadline at risk')).toBeInTheDocument();
    expect(screen.getByText(/Will be emailed to buyer@example.com/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open transaction TX-9/ })).toHaveAttribute(
      'href',
      '/transaction/TX-9/flow',
    );
  });

  it('should tell an admin the function does not recognise them, and not offer a retry', async () => {
    listAdminTickets.mockRejectedValue(new SupportAdminError(403, 'forbidden'));

    renderDesk();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/not on the support desk admin list/i);
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('should offer a retry for a failure that is not about permission', async () => {
    listAdminTickets.mockRejectedValue(new SupportAdminError(500, 'list_failed'));

    renderDesk();

    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
