// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../components/TransactionInvite', () => ({
  default: () => <div>TransactionInvite</div>,
}));
vi.mock('../../stores/authStore', () => ({
  useIsAuthenticated: (): boolean => true,
}));

const mockGetByCode = vi.fn();
vi.mock('../../services/icp.service', () => ({
  icpService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getTransactionByInviteCode: (...args: unknown[]) => mockGetByCode(...args),
  },
}));

import JoinTransactionPage from '../JoinTransactionPage';

function SellerInviteProbe(): JSX.Element {
  const { pathname } = useLocation();
  return <div data-testid="seller-invite">{pathname}</div>;
}

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/join/:id" element={<JoinTransactionPage />} />
        <Route path="/seller-invite/:transactionId" element={<SellerInviteProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  mockGetByCode.mockReset();
});

describe('JoinTransactionPage - seller links emailed before the accept page', () => {
  it('should send an old role=seller link to the seller accept page for its deal, never the code join', async () => {
    mockGetByCode.mockResolvedValue({ id: 'tx_42', propertyAddress: '1 Test Street' });
    renderAt('/join/TX-1234-ABCD?role=seller&side=seller&by=aaa');

    expect((await screen.findByTestId('seller-invite')).textContent).toBe('/seller-invite/tx_42');
    expect(mockGetByCode).toHaveBeenCalledWith('TX-1234-ABCD');
    expect(screen.queryByText('TransactionInvite')).toBeNull();
  });

  it('should say the link is out of date when its code no longer resolves', async () => {
    mockGetByCode.mockResolvedValue(null);
    renderAt('/join/TX-1234-ABCD?role=seller');

    expect(await screen.findByText('This invite link is out of date')).toBeTruthy();
    expect(screen.getByText('Ask your estate agent to send you the invite again.')).toBeTruthy();
    expect(screen.queryByText('TransactionInvite')).toBeNull();
  });

  it('should keep the buyer code join for a link without role=seller', async () => {
    renderAt('/join/TX-1234-ABCD?role=buyer');

    expect(await screen.findByText('TransactionInvite')).toBeTruthy();
    expect(mockGetByCode).not.toHaveBeenCalled();
  });
});
