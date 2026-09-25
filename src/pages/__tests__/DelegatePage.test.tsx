// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockLoad = vi.fn();
const mockGrant = vi.fn();
const mockRevoke = vi.fn();
vi.mock('@/services/delegation.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/delegation.service')>()),
  loadDelegationStatus: (...args: unknown[]) => mockLoad(...args),
  grantDelegation: (...args: unknown[]) => mockGrant(...args),
  revokeDelegation: (...args: unknown[]) => mockRevoke(...args),
}));
vi.mock('@/utils/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { DelegationError } from '@/services/delegation.service';
import DelegatePage from '../DelegatePage';

const ID = 'd1000000-0000-0000-0000-000000000001';
const STATUS = { id: ID, transactionId: 'tx_1', role: 'seller' as const, state: 'requested' as const, agencyName: 'Smith & Co', propertyAddress: '14 Elm Road', inviteCode: null, grantedAt: null, revokedAt: null, ledgerPending: false };

function renderPage(): void {
  render(
    <MemoryRouter initialEntries={[`/delegate/${ID}`]}>
      <Routes>
        <Route path="/delegate/:id" element={<DelegatePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DelegatePage', () => {
  beforeEach(() => {
    mockLoad.mockReset();
    mockGrant.mockReset();
    mockRevoke.mockReset();
  });

  it('asks the question in plain words and grants only on the button', async () => {
    mockLoad.mockResolvedValue(STATUS);
    mockGrant.mockResolvedValue({ state: 'active', ledgerPending: false });
    renderPage();
    expect(await screen.findByText('Let Smith & Co act for you on 14 Elm Road?')).toBeInTheDocument();
    expect(screen.getByText(/Nothing is signed for you/)).toBeInTheDocument();
    expect(mockGrant).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, let Smith & Co act for me' }));
    await waitFor(() => expect(mockGrant).toHaveBeenCalledWith(ID));
    expect(await screen.findByText('Smith & Co can now act for you on 14 Elm Road')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open my deal' })).toHaveAttribute('href', '/transaction/tx_1/flow');
    expect(screen.getByTestId('delegate-page')).toHaveAttribute('data-state', 'active');
  });

  it('says the record is still being written when the platform reports the anchor pending', async () => {
    mockLoad.mockResolvedValue(STATUS);
    mockGrant.mockResolvedValue({ state: 'active', ledgerPending: true });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, let Smith & Co act for me' }));
    expect(await screen.findByText(/The record is being written now/)).toBeInTheDocument();
  });

  it('an active delegation can be withdrawn from the same page', async () => {
    mockLoad.mockResolvedValue({ ...STATUS, state: 'active' });
    mockRevoke.mockResolvedValue({ state: 'revoked', ledgerPending: false });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw this' }));
    await waitFor(() => expect(mockRevoke).toHaveBeenCalledWith(ID));
    expect(await screen.findByText('Smith & Co no longer acts for you on 14 Elm Road')).toBeInTheDocument();
  });

  it('a platform refusal is explained in plain words and the page stays put', async () => {
    mockLoad.mockResolvedValue(STATUS);
    mockGrant.mockRejectedValue(new DelegationError('wrong_party'));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, let Smith & Co act for me' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('sent to the other side of the deal');
    expect(screen.getByTestId('delegate-page')).toHaveAttribute('data-state', 'requested');
  });

  it('an unknown or withdrawn request shows the missing state', async () => {
    mockLoad.mockRejectedValue(new DelegationError('not_found'));
    renderPage();
    expect(await screen.findByTestId('delegate-missing')).toHaveTextContent('The link may be old');
  });
});
