// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Transaction } from '@/types/transaction.types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/components/brand/Logo', () => ({ Logo: () => null }));
vi.mock('../../stores/authStore', () => ({ useIsAuthenticated: (): boolean => true }));

const mockMarkOnboarded = vi.fn().mockResolvedValue(undefined);
vi.mock('@/services/onboardingStatus', () => ({ markUserOnboarded: () => mockMarkOnboarded() }));

vi.mock('../../components/TransactionInvite', () => ({
  default: ({ onJoinSuccess }: { onJoinSuccess: (tx: Transaction) => void }) => (
    <button type="button" onClick={() => onJoinSuccess({ id: 'tx-1' } as Transaction)}>join</button>
  ),
}));

import JoinTransactionPage from '../JoinTransactionPage';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('JoinTransactionPage onboarding status', () => {
  it('should mark an invite-link buyer onboarded on their account when the join succeeds', async () => {
    render(
      <MemoryRouter initialEntries={['/join/TX-1234-ABCD?role=buyer']}>
        <Routes>
          <Route path="/join/:id" element={<JoinTransactionPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'join' }));

    expect(mockMarkOnboarded).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});
