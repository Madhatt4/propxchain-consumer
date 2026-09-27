// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The public help page's two routes. Signed in, a request becomes a real
 * support ticket — the one the admin queue shows and the team is emailed
 * about. Signed out, it is emailed, because a ticket needs an account to
 * belong to. A signed-in request that emailed instead would never reach the
 * admin queue, which is the failure this file exists to stop.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockSendEnquiry = vi.fn();
vi.mock('@/services/enquiry.service', () => ({
  sendEnquiry: (...args: unknown[]) => mockSendEnquiry(...args),
}));

const mockCreateTicket = vi.fn();
vi.mock('@/services/supportTicket.service', () => ({
  MAX_SUBJECT: 200,
  createTicket: (...args: unknown[]) => mockCreateTicket(...args),
}));

let authenticated = false;
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => unknown) => selector({ isAuthenticated: authenticated }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import SupportPage from '../SupportPage';

function setField(name: string, value: string): void {
  const el = document.querySelector(`[name="${name}"]`);
  if (!el) throw new Error(`no field named ${name}`);
  fireEvent.change(el, { target: { value } });
}

function submitForm(): void {
  const form = document.querySelector('form');
  if (!form) throw new Error('no form');
  fireEvent.submit(form);
}

function renderPage(): void {
  render(<MemoryRouter><SupportPage /></MemoryRouter>);
}

describe('SupportPage', () => {
  beforeEach(() => {
    mockSendEnquiry.mockReset().mockResolvedValue(undefined);
    mockCreateTicket.mockReset().mockResolvedValue({ id: 'ticket-1' });
    mockNavigate.mockReset();
    authenticated = false;
    window.alert = vi.fn();
  });

  it('should raise a ticket, not an email, when the visitor is signed in', async () => {
    authenticated = true;
    renderPage();
    setField('subject', 'documents');
    setField('message', 'My TA6 will not upload\nIt spins forever.');

    submitForm();

    await waitFor(() => expect(mockCreateTicket).toHaveBeenCalledTimes(1));
    expect(mockCreateTicket).toHaveBeenCalledWith({
      subject: 'Document Upload Issues: My TA6 will not upload',
      body: 'Topic: Document Upload Issues\n\nMy TA6 will not upload\nIt spins forever.',
      pagePath: '/support',
      source: 'form',
    });
    expect(mockSendEnquiry).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/support/tickets/ticket-1');
  });

  it('should not ask a signed-in visitor for the name and email the ticket already has', () => {
    authenticated = true;
    renderPage();

    expect(document.querySelector('[name="name"]')).toBeNull();
    expect(document.querySelector('[name="email"]')).toBeNull();
    expect(screen.getByText(/opens a support ticket on your account/)).toBeTruthy();
  });

  it('should keep the subject within the column limit', async () => {
    authenticated = true;
    renderPage();
    setField('subject', 'technical');
    setField('message', 'x'.repeat(400));

    submitForm();

    await waitFor(() => expect(mockCreateTicket).toHaveBeenCalledTimes(1));
    expect(mockCreateTicket.mock.calls[0][0].subject.length).toBeLessThanOrEqual(200);
  });

  it('should fall back to the email form when a ticket cannot be raised', async () => {
    authenticated = true;
    mockCreateTicket.mockRejectedValue(new Error('unauthorised'));
    renderPage();
    setField('subject', 'other');
    setField('message', 'Help');

    submitForm();

    await waitFor(() => expect(document.querySelector('[name="email"]')).not.toBeNull());
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('by email instead'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should email the request when the visitor is signed out', async () => {
    renderPage();
    setField('name', 'Sam Help');
    setField('email', 'sam@example.com');
    setField('subject', 'technical');
    setField('message', 'It broke');

    submitForm();

    await waitFor(() => expect(mockSendEnquiry).toHaveBeenCalledTimes(1));
    expect(mockCreateTicket).not.toHaveBeenCalled();
  });
});
