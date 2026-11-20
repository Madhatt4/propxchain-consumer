// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../hooks/useThemeClasses', () => ({
  useThemeClasses: () => ({}),
}));

const mockJoinAsBuyer = vi.fn();
const mockPlainJoin = vi.fn();
const mockGetByCode = vi.fn();
vi.mock('../../services/icp.service', () => ({
  icpService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getTransactionByInviteCode: (...args: unknown[]) => mockGetByCode(...args),
    joinTransactionByInviteCodeAsBuyer: (...args: unknown[]) => mockJoinAsBuyer(...args),
    joinTransactionByInviteCode: (...args: unknown[]) => mockPlainJoin(...args),
  },
}));

vi.mock('../../stores/authStore', () => ({
  getStorePrincipalId: () => 'joiner-principal',
  getStoreIsAuthenticated: () => true,
}));

const mockRecordFromChain = vi.fn().mockResolvedValue({ ok: true });
const mockRecordMine = vi.fn();
vi.mock('../../services/partyRole.service', () => ({
  partyRoleService: {
    recordRoleFromChain: (...args: unknown[]) => mockRecordFromChain(...args),
    recordMyRole: (...args: unknown[]) => mockRecordMine(...args),
  },
}));

vi.mock('../../services/plotClaim.service', () => ({
  checkPlotClaim: vi.fn(),
  claimPlot: vi.fn(),
  getPlotDeveloperPrincipal: vi.fn(),
  plotClaimBlockedReason: vi.fn(),
}));

vi.mock('@/services/rightmove.service', () => ({ scrapeRightmoveListing: vi.fn() }));
vi.mock('@/utils/rightmoveStorage', () => ({ storeRightmoveData: vi.fn() }));

import TransactionInvite from '../TransactionInvite';

const CODE = 'TX-JPEN-Z4HM';
const DEAL = {
  id: 'tx_1',
  inviteCode: CODE,
  propertyAddress: '1 Test Street',
  postcode: 'SG19 1AA',
  seller: 'seller-principal',
  buyer: 'seller-principal',
  createdBy: 'seller-principal',
  status: 'active',
  mode: 'diy',
  transactionType: 'sale',
};

async function renderAtJoinStep(onJoinSuccess = vi.fn()): Promise<void> {
  render(
    <MemoryRouter>
      <TransactionInvite onJoinSuccess={onJoinSuccess} initialCode={CODE} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByText('1 Test Street');
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockGetByCode.mockResolvedValue(DEAL);
  mockJoinAsBuyer.mockResolvedValue(DEAL);
});

describe('TransactionInvite - invite codes are buyer-only', () => {
  it('should not offer a role picker once the deal is found', async () => {
    await renderAtJoinStep();

    expect(screen.queryByText('Select Your Role')).toBeNull();
    for (const role of ['Seller', 'Solicitor / Conveyancer', 'Estate Agent']) {
      expect(screen.queryByRole('button', { name: new RegExp(role) })).toBeNull();
    }
    expect(screen.queryByLabelText('Joining as someone else?')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('should tell non-buyers how they get in and link conveyancers to registration', async () => {
    await renderAtJoinStep();

    expect(screen.getByText(/This invite is for the buyer\./)).toBeTruthy();
    expect(screen.getByText(/Estate agents are invited by the seller from the deal page\./)).toBeTruthy();
    const register = screen.getByRole('link', { name: 'register' });
    expect(register.getAttribute('href')).toBe('/register/conveyancer');
  });

  it('should always join through the buyer-only canister method', async () => {
    const onJoinSuccess = vi.fn();
    await renderAtJoinStep(onJoinSuccess);

    fireEvent.click(screen.getByRole('button', { name: 'Join Transaction' }));

    await screen.findByText('Successfully Joined!');
    expect(mockJoinAsBuyer).toHaveBeenCalledWith(CODE);
    expect(mockPlainJoin).not.toHaveBeenCalled();
    expect(mockRecordFromChain).toHaveBeenCalledWith('tx_1');
    expect(mockRecordMine).not.toHaveBeenCalled();
  });

  it('should show a plain message when the deal already has a buyer', async () => {
    mockJoinAsBuyer.mockRejectedValue(
      new Error('Buyer slot already taken — ask the seller to assign you via assignBuyer'),
    );
    await renderAtJoinStep();

    fireEvent.click(screen.getByRole('button', { name: 'Join Transaction' }));

    await waitFor(() =>
      expect(screen.getByText('This deal already has a buyer. Ask the seller for help.')).toBeTruthy(),
    );
    expect(screen.queryByText(/assignBuyer/)).toBeNull();
    expect(mockPlainJoin).not.toHaveBeenCalled();
  });

  it("should read the canister's current buyer-taken text as the same plain message", async () => {
    mockJoinAsBuyer.mockRejectedValue(new Error('This deal already has a buyer'));
    await renderAtJoinStep();

    fireEvent.click(screen.getByRole('button', { name: 'Join Transaction' }));

    await screen.findByText('This deal already has a buyer. Ask the seller for help.');
  });

  it('should treat "already the buyer" as a join that went through and go on to the deal', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockJoinAsBuyer.mockRejectedValue(new Error('You are already the buyer on this deal'));
      const onJoinSuccess = vi.fn();
      await renderAtJoinStep(onJoinSuccess);

      fireEvent.click(screen.getByRole('button', { name: 'Join Transaction' }));

      await screen.findByText('Successfully Joined!');
      vi.advanceTimersByTime(1500);
      await waitFor(() => expect(onJoinSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: 'tx_1' })));
      expect(mockRecordFromChain).toHaveBeenCalledWith('tx_1');
      expect(screen.queryByText('You are already the buyer on this deal')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('should say the code only adds the buyer when the caller is already on the deal', async () => {
    mockJoinAsBuyer.mockRejectedValue(new Error('You are already on this deal. The invite code only adds the buyer'));
    await renderAtJoinStep();

    fireEvent.click(screen.getByRole('button', { name: 'Join Transaction' }));

    await screen.findByText('You are already on this deal. The invite code only adds the buyer.');
    expect(screen.queryByText('Successfully Joined!')).toBeNull();
  });

  it('should say a used-up code has been used, and to ask the seller for a new one', async () => {
    mockJoinAsBuyer.mockRejectedValue(new Error('Invalid invite code'));
    await renderAtJoinStep();

    fireEvent.click(screen.getByRole('button', { name: 'Join Transaction' }));

    await screen.findByText('This invite code has already been used. Ask the seller for a new one.');
  });

  it('should pass any other canister error through unchanged', async () => {
    mockJoinAsBuyer.mockRejectedValue(new Error('Cannot self-assign as buyer after contract exchange'));
    await renderAtJoinStep();

    fireEvent.click(screen.getByRole('button', { name: 'Join Transaction' }));

    await screen.findByText('Cannot self-assign as buyer after contract exchange');
  });
});
