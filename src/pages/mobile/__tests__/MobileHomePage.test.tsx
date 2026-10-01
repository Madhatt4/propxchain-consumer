// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Transaction } from '@/types/transaction.types';
import MobileHomePage from '../MobileHomePage';

const { mockHook } = vi.hoisted(() => ({ mockHook: vi.fn() }));

vi.mock('../useMobileTransactions', () => ({ useMobileTransactions: mockHook }));
vi.mock('@/components/common/NextStepCard', () => ({
  default: ({ txId }: { txId: string }) => <div data-testid="next-step-stub">{txId}</div>,
}));

const tx = (id: string, propertyAddress: string, status = 'active'): Transaction =>
  ({ id, propertyAddress, status }) as unknown as Transaction;

const renderPage = () =>
  render(
    <MemoryRouter>
      <MobileHomePage />
    </MemoryRouter>,
  );

describe('MobileHomePage', () => {
  beforeEach(() => {
    mockHook.mockReset();
  });

  it('should show a loading state while transactions load', () => {
    mockHook.mockReturnValue({ isLoading: true, isError: false, data: undefined, refetch: vi.fn() });
    renderPage();
    expect(screen.getByRole('status', { name: /loading your transactions/i })).toBeTruthy();
  });

  it('should offer to start a sale or join one when there are no transactions', () => {
    mockHook.mockReturnValue({ isLoading: false, isError: false, data: [], refetch: vi.fn() });
    renderPage();
    expect(screen.getByTestId('mobile-home-empty')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Start a sale' }).getAttribute('href')).toBe('/start-transaction');
    expect(screen.getByRole('link', { name: 'Join with an invite' }).getAttribute('href')).toBe('/join');
  });

  it('should show the address, status and next step for each transaction', () => {
    mockHook.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [tx('tx-1', '1 High Street, Sandy'), tx('tx-2', '2 Mill Lane, Biggleswade', 'exchanged')],
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getAllByTestId('mobile-home-transaction')).toHaveLength(2);
    expect(screen.getByText('1 High Street, Sandy')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('Exchanged')).toBeTruthy();
    expect(screen.getAllByTestId('next-step-stub').map((el) => el.textContent)).toEqual(['tx-1', 'tx-2']);
  });

  it('should link each transaction to its flow page', () => {
    mockHook.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [tx('tx-1', '1 High Street, Sandy')],
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByRole('link', { name: 'Open transaction' }).getAttribute('href')).toBe(
      '/transaction/tx-1/flow',
    );
  });

  it('should let the user try again when loading fails', () => {
    const refetch = vi.fn();
    mockHook.mockReturnValue({ isLoading: false, isError: true, data: undefined, refetch });
    renderPage();
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('should say a missing address is not set rather than render a blank heading', () => {
    mockHook.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [tx('tx-1', '')],
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('Property address not set')).toBeTruthy();
  });
});
