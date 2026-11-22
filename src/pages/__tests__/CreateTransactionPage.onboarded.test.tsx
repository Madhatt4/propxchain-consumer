// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

interface SubmittedDetails {
  address: string;
  postcode: string;
  propertyType: 'freehold' | 'leasehold' | '';
  titleNumber: string;
  salePrice: number;
  sellerCount: 1 | 2;
}
type SubmitHandler = (details: SubmittedDetails) => Promise<{ transactionId: string; inviteCode: string }>;

const captured: { onSubmit: SubmitHandler | null } = { onSubmit: null };
vi.mock('../../components/forms/CreateTransactionForm', () => ({
  default: ({ onSubmit }: { onSubmit: SubmitHandler }) => {
    captured.onSubmit = onSubmit;
    return null;
  },
}));
vi.mock('@/components/navigation/AppTopBar', () => ({ default: () => null }));
vi.mock('../../stores/authStore', () => ({ usePrincipalId: () => 'aaaaa-aa' }));
vi.mock('../../services/partyRole.service', () => ({ partyRoleService: { recordRoleFromChain: vi.fn() } }));
vi.mock('@/utils/rightmoveStorage', () => ({ storeRightmoveData: vi.fn(), storeTitleNumber: vi.fn() }));

const mockCreate = vi.fn();
vi.mock('../../services/icp.service', () => ({
  icpService: {
    initAuth: vi.fn().mockResolvedValue(true),
    requireTransactionManager: vi.fn().mockResolvedValue({
      createTransactionWithInvite: (...args: unknown[]) => mockCreate(...args),
    }),
  },
}));

const mockMarkOnboarded = vi.fn().mockResolvedValue(undefined);
vi.mock('@/services/onboardingStatus', () => ({ markUserOnboarded: () => mockMarkOnboarded() }));

import CreateTransactionPage from '../CreateTransactionPage';

const details: SubmittedDetails = {
  address: '1 Test Street',
  postcode: 'AB1 2CD',
  propertyType: 'freehold',
  titleNumber: '',
  salePrice: 250000,
  sellerCount: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  captured.onSubmit = null;
});

describe('CreateTransactionPage onboarding status', () => {
  it('should mark the user onboarded on their account once the transaction is created', async () => {
    mockCreate.mockResolvedValue({ ok: ['tx-1', 'ABC123'] });
    render(<MemoryRouter><CreateTransactionPage /></MemoryRouter>);

    await captured.onSubmit?.(details);

    expect(mockMarkOnboarded).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('needsOnboarding')).toBeNull();
  });

  it('should not mark the user onboarded when the transaction is not created', async () => {
    mockCreate.mockResolvedValue({ err: 'rejected' });
    render(<MemoryRouter><CreateTransactionPage /></MemoryRouter>);

    await expect(captured.onSubmit?.(details)).rejects.toThrow('rejected');

    expect(mockMarkOnboarded).not.toHaveBeenCalled();
  });
});
