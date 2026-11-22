// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Transaction } from '@/types/transaction.types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('@/components/brand/Logo', () => ({ Logo: () => null }));
vi.mock('@/stores/authStore', () => ({ usePrincipalId: () => 'principal-test' }));

const mockMarkOnboarded = vi.fn().mockResolvedValue(undefined);
vi.mock('@/services/onboardingStatus', () => ({ markUserOnboarded: () => mockMarkOnboarded() }));

vi.mock('@/components/TransactionInvite', () => ({
  default: ({ onJoinSuccess }: { onJoinSuccess: (tx: Transaction) => void }) => (
    <button type="button" onClick={() => onJoinSuccess({ id: 'tx-1' } as Transaction)}>join</button>
  ),
}));

import OnboardingJoinPage from '../OnboardingJoinPage';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('onboardingRole', 'buyer');
});

describe('OnboardingJoinPage', () => {
  it('should mark the user onboarded on their account when they join a transaction', () => {
    render(<MemoryRouter><OnboardingJoinPage /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'join' }));

    expect(mockMarkOnboarded).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('onboardingComplete')).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});
