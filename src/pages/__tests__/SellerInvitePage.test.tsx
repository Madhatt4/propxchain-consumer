// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('@/utils/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock('@/components/auth/RequirePrincipal', () => ({ default: ({ children }: { children: JSX.Element }) => children }));
vi.mock('@/components/auth/RequireProfile', () => ({ default: ({ children }: { children: JSX.Element }) => children }));

const authState = { isAuthenticated: true, isInitialized: true, isLoading: false };
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (select: (s: typeof authState) => unknown) => select(authState),
}));

const mockGetTransaction = vi.fn();
vi.mock('@/services/icp.service', () => ({
  icpService: { getTransaction: (...args: unknown[]) => mockGetTransaction(...args) },
}));

const mockRecordFromChain = vi.fn();
vi.mock('@/services/partyRole.service', () => ({
  partyRoleService: { recordRoleFromChain: (...args: unknown[]) => mockRecordFromChain(...args) },
}));

import SellerInvitePage from '../SellerInvitePage';
import { PENDING_INVITE_URL_KEY } from '@/utils/pendingInviteUrl';

const TX = 'tx_1794076530509808062';

function Probe({ label }: { label: string }): JSX.Element {
  const { pathname, search } = useLocation();
  return <div data-testid={label}>{pathname + search}</div>;
}

function renderPage(): void {
  render(
    <MemoryRouter initialEntries={[`/seller-invite/${TX}`]}>
      <Routes>
        <Route path="/seller-invite/:transactionId" element={<SellerInvitePage />} />
        <Route path="/register" element={<Probe label="register" />} />
        <Route path="/transaction/:id/flow" element={<Probe label="deal" />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function clickAccept(): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: 'Accept and take over as the seller' }));
}

describe('SellerInvitePage', () => {
  beforeEach(() => {
    localStorage.clear();
    authState.isAuthenticated = true;
    mockGetTransaction.mockReset().mockResolvedValue(null);
    mockRecordFromChain.mockReset();
  });

  it('should send a signed-out seller to register and keep this page to come back to', async () => {
    authState.isAuthenticated = false;
    renderPage();

    const register = await screen.findByTestId('register');
    expect(register.textContent).toBe(`/register?invite=${TX}&role=seller`);
    expect(localStorage.getItem(PENDING_INVITE_URL_KEY)).toBe(`/seller-invite/${TX}`);
    expect(mockRecordFromChain).not.toHaveBeenCalled();
  });

  it('should show one accept button and the agent line, and accept only on the click', async () => {
    renderPage();

    await screen.findByText('Your estate agent invited you to take over this sale. They stay on the deal as your agent.');
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByText(/TX-/)).toBeNull();
    expect(mockRecordFromChain).not.toHaveBeenCalled();
  });

  it('should show the property address when the deal is readable', async () => {
    mockGetTransaction.mockResolvedValue({ propertyAddress: '14 Elm Road' });
    renderPage();

    expect(await screen.findByRole('heading', { name: '14 Elm Road' })).toBeTruthy();
    expect(mockGetTransaction).toHaveBeenCalledWith(TX);
  });

  it('should still offer the accept when the deal cannot be read yet', async () => {
    mockGetTransaction.mockRejectedValue(new Error('Unauthorized'));
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Take over your sale' })).toBeTruthy();
  });

  it('should take over and go to the deal on success', async () => {
    mockRecordFromChain.mockResolvedValue({ ok: true, role: 'seller', side: 'seller', created: true });
    renderPage();
    await clickAccept();

    const deal = await screen.findByTestId('deal');
    expect(deal.textContent).toBe(`/transaction/${TX}/flow`);
    expect(mockRecordFromChain).toHaveBeenCalledWith(TX);
  });

  it.each([
    [{ error: 'email_unverified' }, 'Confirm your email address first. Open the confirmation email we sent you, then try again.'],
    [{ error: 'agent_flow_owns_roles' }, 'This invite is for someone else. Sign in with the email address your estate agent sent it to.'],
    [{ error: 'handover_refused', detail: 'The seller slot has already been handed over' }, 'This sale has already been handed over to its seller.'],
    [{ error: 'handover_refused', detail: 'Cannot change the seller after contract exchange' }, 'Contracts have been exchanged, so the seller can no longer change.'],
    [{ error: 'handover_refused', detail: 'The buyer cannot become the seller' }, 'You are the buyer on this deal, so you cannot take it over as the seller.'],
    [{ error: 'handover_refused' }, 'We could not hand this sale over to you. Ask your estate agent for help.'],
    [{ error: 'transaction_not_found' }, 'We could not find this sale. Ask your estate agent to send the invite again.'],
    [{ error: 'rate_limited' }, 'Too many tries. Wait a few minutes, then try again.'],
    [{ error: 'chain_read_failed' }, 'We could not hand the sale over to you just now. Try again in a moment.'],
  ])('should explain %o in one plain line and stay on the page', async (refusal, line) => {
    mockRecordFromChain.mockResolvedValue({ ok: false, ...refusal });
    renderPage();
    await clickAccept();

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(line));
    expect(screen.queryByTestId('deal')).toBeNull();
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false);
  });
});
