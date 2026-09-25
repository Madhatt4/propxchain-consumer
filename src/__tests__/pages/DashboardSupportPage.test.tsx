// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockCreateTicket = vi.fn();
vi.mock('../../services/supportTicket.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/supportTicket.service')>();
  return { ...actual, createTicket: (...args: unknown[]) => mockCreateTicket(...args) };
});

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// The dashboard chrome reaches for the canister (admin check, notifications);
// this page's contract is the form, so the shell is stubbed out.
vi.mock('../../components/navigation/DashboardSidebar', () => ({ default: () => <nav data-testid="sidebar" /> }));
vi.mock('../../components/navigation/DashboardHeader', () => ({ default: () => <header data-testid="header" /> }));

import DashboardSupportPage from '../../pages/DashboardSupportPage';
import { useAuthStore } from '../../stores/authStore';

const TICKET = { id: 'abc-123', subject: 'TA6 form will not save' };

function renderPage(state?: Record<string, unknown>): void {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/dashboard/support', state }]}>
      <Routes>
        <Route path="/dashboard/support" element={<DashboardSupportPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function fillAndSubmit(): void {
  fireEvent.change(screen.getByLabelText(/Topic/i), { target: { value: 'technical' } });
  fireEvent.change(screen.getByLabelText(/Subject/i), { target: { value: 'TA6 form will not save' } });
  fireEvent.change(screen.getByLabelText(/Message/i), { target: { value: 'It spins forever on question 4.' } });
  const form = screen.getByRole('button', { name: /Submit Support Request/i }).closest('form');
  if (!form) throw new Error('the support form is not in the document');
  fireEvent.submit(form);
}

describe('DashboardSupportPage', () => {
  beforeEach(() => {
    mockCreateTicket.mockReset().mockResolvedValue(TICKET);
    mockNavigate.mockReset();
    useAuthStore.setState({ isAuthenticated: true, principalId: 'aaaaa-aa' });
  });

  it('should submit through the support-ticket service, not the canister', async () => {
    renderPage();
    fillAndSubmit();

    await waitFor(() => expect(mockCreateTicket).toHaveBeenCalledTimes(1));
    expect(mockCreateTicket).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'TA6 form will not save', source: 'form', pagePath: '/dashboard/support' }),
    );
  });

  it('should put the chosen topic in the body so triage and support both see it', async () => {
    renderPage();
    fillAndSubmit();

    await waitFor(() => expect(mockCreateTicket).toHaveBeenCalled());
    const [input] = mockCreateTicket.mock.calls[0] as [{ body: string }];
    expect(input.body).toBe('Topic: Technical Issue\n\nIt spins forever on question 4.');
  });

  it('should navigate to the new ticket on success', async () => {
    renderPage();
    fillAndSubmit();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard/support/tickets/abc-123'));
  });

  it('should carry the referring page and transaction through from router state', async () => {
    renderPage({ pagePath: '/transaction/TX-9/forms/ta6', transactionId: 'TX-9', stage: 'pre_contract' });
    fillAndSubmit();

    await waitFor(() => expect(mockCreateTicket).toHaveBeenCalled());
    expect(mockCreateTicket).toHaveBeenCalledWith(
      expect.objectContaining({ pagePath: '/transaction/TX-9/forms/ta6', transactionId: 'TX-9', stage: 'pre_contract' }),
    );
  });

  it('should show a recoverable error and stay put when the ticket cannot be raised', async () => {
    mockCreateTicket.mockRejectedValue(new Error('rate_limited'));
    renderPage();
    fillAndSubmit();

    expect(await screen.findByText(/could not raise your ticket/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should not ask for a name or an email: the function takes both from the session', () => {
    renderPage();

    expect(screen.queryByLabelText(/^Name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Email/i)).not.toBeInTheDocument();
  });

  it('should link to the ticket list', () => {
    renderPage();

    expect(screen.getByRole('link', { name: /My tickets/i })).toHaveAttribute('href', '/dashboard/support/tickets');
  });

  it('should send an unauthenticated visitor to the login page', () => {
    useAuthStore.setState({ isAuthenticated: false, principalId: null });
    renderPage();

    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});
