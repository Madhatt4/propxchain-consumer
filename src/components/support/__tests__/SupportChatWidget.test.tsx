// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The widget is exercised against a mocked Supabase client rather than mocked
 * services, so the bodies asserted here are the ones that would really go to
 * `support-chat` and `support-ticket`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockInvoke = vi.fn();
vi.mock('../../../lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

let authenticated = true;
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => unknown) => selector({ isAuthenticated: authenticated }),
}));

vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { useActiveTransactionStore } from '../../../stores/activeTransactionStore';
import { isDashboardPath } from '../chatRoutes';
import SupportChatWidget from '../SupportChatWidget';

interface InvokeBody {
  messages?: { role: string; text: string }[];
  context?: Record<string, unknown>;
  action?: string;
  subject?: string;
  body?: string;
  source?: string;
  transcript?: { role: string; text: string }[];
  transactionId?: string;
  stage?: string;
  pagePath?: string;
}

/** The last body sent to a given function name. */
function bodyFor(fn: string): InvokeBody {
  const call = [...mockInvoke.mock.calls].reverse().find((c) => c[0] === fn) as [string, { body: InvokeBody }] | undefined;
  if (!call) throw new Error(`no invoke of ${fn}`);
  return call[1].body;
}

function reply(overrides: Partial<{ reply: string; suggestTicket: boolean; sources: string[] }> = {}): unknown {
  return {
    data: {
      reply: 'Your pack is on the Documents tab.',
      intent: 'product_help',
      confidence: 0.8,
      suggestTicket: false,
      sources: [],
      model: 'deepseek/deepseek-v4-flash-0731',
      ...overrides,
    },
    error: null,
  };
}

function renderAt(pathname: string): void {
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <SupportChatWidget />
    </MemoryRouter>,
  );
}

function openPanel(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Open help chat' }));
}

async function ask(text: string): Promise<void> {
  fireEvent.change(screen.getByLabelText('Your message'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(screen.getByText(text)).toBeTruthy());
}

describe('SupportChatWidget', () => {
  beforeEach(() => {
    mockInvoke.mockReset().mockResolvedValue(reply());
    mockNavigate.mockReset();
    authenticated = true;
    sessionStorage.clear();
    useActiveTransactionStore.getState().setActiveTransaction(null);
  });

  it('should treat the dashboard, the transaction pages and nothing else as its routes', () => {
    expect(isDashboardPath('/dashboard')).toBe(true);
    expect(isDashboardPath('/dashboard/support/tickets/abc')).toBe(true);
    expect(isDashboardPath('/transaction-dashboard')).toBe(true);
    expect(isDashboardPath('/transaction/tx-1/flow')).toBe(true);
    expect(isDashboardPath('/transaction/tx-1/forms/ta6')).toBe(true);
    expect(isDashboardPath('/')).toBe(false);
    expect(isDashboardPath('/login')).toBe(false);
    // A route that merely starts with the same letters is not a dashboard route.
    expect(isDashboardPath('/dashboards')).toBe(false);
    expect(isDashboardPath('/transactions')).toBe(false);
  });

  it('should show the launcher on a dashboard route', () => {
    renderAt('/dashboard/settings');

    expect(screen.getByRole('button', { name: 'Open help chat' })).toBeTruthy();
  });

  it('should render nothing off the dashboard and transaction pages', () => {
    renderAt('/login');

    expect(screen.queryByRole('button', { name: 'Open help chat' })).toBeNull();
  });

  it('should render nothing when the user is not signed in', () => {
    authenticated = false;
    renderAt('/dashboard');

    expect(screen.queryByRole('button', { name: 'Open help chat' })).toBeNull();
  });

  it('should send the page path, and no transaction when none is selected', async () => {
    renderAt('/dashboard/my-documents');
    openPanel();

    await ask('Where is my pack?');

    await waitFor(() => expect(bodyFor('support-chat').context).toEqual({ pagePath: '/dashboard/my-documents' }));
    expect(bodyFor('support-chat').messages).toEqual([{ role: 'user', text: 'Where is my pack?' }]);
  });

  it('should send the selected transaction and its stage as context', async () => {
    useActiveTransactionStore.getState().setActiveTransaction({ id: 'tx-77', status: 'exchanged' });
    renderAt('/dashboard');
    openPanel();

    await ask('How far along am I?');

    await waitFor(() =>
      expect(bodyFor('support-chat').context).toEqual({ pagePath: '/dashboard', transactionId: 'tx-77', stage: 'exchanged' }),
    );
  });

  it('should carry the whole conversation on the second turn', async () => {
    renderAt('/dashboard');
    openPanel();
    await ask('First question');
    await waitFor(() => expect(screen.getByText('Your pack is on the Documents tab.')).toBeTruthy());

    await ask('Second question');

    await waitFor(() => expect(bodyFor('support-chat').messages).toHaveLength(3));
    expect(bodyFor('support-chat').messages?.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
  });

  it('should offer a ticket as soon as the reply says to', async () => {
    mockInvoke.mockResolvedValue(reply({ suggestTicket: true }));
    renderAt('/dashboard');
    openPanel();

    expect(screen.queryByRole('button', { name: /Open a ticket/ })).toBeNull();
    await ask('This is broken');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Open a ticket with this conversation' })).toBeTruthy());
  });

  it('should offer a ticket after three turns even when the reply does not ask for one', async () => {
    renderAt('/dashboard');
    openPanel();

    await ask('One');
    await waitFor(() => expect(screen.getAllByText('Your pack is on the Documents tab.')).toHaveLength(1));
    expect(screen.queryByRole('button', { name: /Open a ticket/ })).toBeNull();
    await ask('Two');
    await waitFor(() => expect(screen.getAllByText('Your pack is on the Documents tab.')).toHaveLength(2));
    await ask('Three');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Open a ticket with this conversation' })).toBeTruthy());
  });

  it('should hand the whole transcript, the context and source chat to the ticket, then open it', async () => {
    mockInvoke.mockImplementation((fn: string) =>
      fn === 'support-ticket'
        ? Promise.resolve({ data: { ticket: { id: 'ticket-1' } }, error: null })
        : Promise.resolve(reply({ suggestTicket: true, reply: 'I cannot confirm that.' })),
    );
    useActiveTransactionStore.getState().setActiveTransaction({ id: 'tx-5', status: 'active' });
    renderAt('/dashboard');
    openPanel();
    await ask('My completion date moved and nobody told me');
    const offer = await screen.findByRole('button', { name: 'Open a ticket with this conversation' });

    fireEvent.click(offer);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard/support/tickets/ticket-1'));
    const ticket = bodyFor('support-ticket');
    expect(ticket.action).toBe('create');
    expect(ticket.source).toBe('chat');
    expect(ticket.transcript).toEqual([
      { role: 'user', text: 'My completion date moved and nobody told me' },
      { role: 'bot', text: 'I cannot confirm that.' },
    ]);
    expect(ticket.subject).toBe('My completion date moved and nobody told me');
    expect(ticket.body).toBe('My completion date moved and nobody told me');
    expect(ticket).toMatchObject({ transactionId: 'tx-5', stage: 'active', pagePath: '/dashboard' });
  });

  it('should show the not-legal-advice line once, on the first answer of the session', async () => {
    renderAt('/dashboard');
    openPanel();

    await ask('One');
    await waitFor(() => expect(screen.getAllByText(/not legal advice/i)).toHaveLength(1));
    await ask('Two');
    await waitFor(() => expect(screen.getAllByText('Your pack is on the Documents tab.')).toHaveLength(2));

    expect(screen.getAllByText(/not legal advice/i)).toHaveLength(1);
  });

  it('should keep the question on screen and explain itself when the send fails', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'x', context: { status: 429, json: () => Promise.resolve({ error: 'rate_limited', resetIn: 20 }) } },
    });
    renderAt('/dashboard');
    openPanel();

    await ask('Too many questions');

    await waitFor(() => expect(screen.getByText(/Give it a moment/)).toBeTruthy());
    expect(screen.getByText('Too many questions')).toBeTruthy();
  });

  it('should not greet the next open with the error from the last one', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'x', context: { status: 500, json: () => Promise.resolve({ error: 'chat_failed' }) } },
    });
    renderAt('/dashboard');
    openPanel();
    await ask('Something');
    await waitFor(() => expect(screen.getByText(/our end/)).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Close help chat', expanded: true }));
    openPanel();

    expect(screen.queryByText(/our end/)).toBeNull();
    // The conversation itself survives — closing a chat is not abandoning it.
    expect(screen.getByText('Something')).toBeTruthy();
  });

  it('should keep the draft in sessionStorage and clear it once sent', async () => {
    renderAt('/dashboard');
    openPanel();

    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'half a thought' } });
    expect(sessionStorage.getItem('pxc.supportChat.draft')).toBe('half a thought');

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(sessionStorage.getItem('pxc.supportChat.draft')).toBeNull());
  });

  it('should close on Escape and give focus back to the launcher', () => {
    renderAt('/dashboard');
    openPanel();
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open help chat' }));
  });

  it('should label the launcher for a screen reader in both states', () => {
    renderAt('/dashboard');
    openPanel();

    expect(screen.getByRole('button', { name: 'Close help chat', expanded: true })).toBeTruthy();
  });
});
