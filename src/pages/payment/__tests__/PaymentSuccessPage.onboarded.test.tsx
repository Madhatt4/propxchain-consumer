// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockVerifySession = vi.fn();
vi.mock('@/services/stripePayment.service', () => ({
  stripePaymentService: { verifySession: (sessionId: string) => mockVerifySession(sessionId) },
}));
vi.mock('@/services/searchCheckoutResume', () => ({ loadSearchPendingState: () => null }));
vi.mock('@/services/chainUnlockCheckoutResume', () => ({ loadChainUnlockPendingState: () => null }));

const mockMarkOnboarded = vi.fn().mockResolvedValue(undefined);
vi.mock('@/services/onboardingStatus', () => ({ markUserOnboarded: () => mockMarkOnboarded() }));

const authState: { isInitialized: boolean; principalId: string | null } = {
  isInitialized: true,
  principalId: 'principal-abc',
};
vi.mock('@/stores/authStore', () => {
  const useAuthStore = Object.assign(
    (selector: (s: typeof authState) => unknown) => selector(authState),
    { getState: () => authState },
  );
  return { useAuthStore };
});

import PaymentSuccessPage from '../PaymentSuccessPage';

function renderSuccess(): void {
  render(
    <MemoryRouter initialEntries={['/payment/success?session_id=cs_test_1']}>
      <PaymentSuccessPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  authState.principalId = 'principal-abc';
});

describe('PaymentSuccessPage onboarding status', () => {
  it('should mark the user onboarded on their account after a verified payment', async () => {
    mockVerifySession.mockResolvedValue({ verified: true, type: 'chain-unlock', tier: 'chain-unlock' });

    renderSuccess();

    await waitFor(() => expect(mockMarkOnboarded).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem('onboardingComplete')).toBeNull();
  });

  it('should mark the user onboarded on their account when no principal is restored', async () => {
    authState.principalId = null;

    renderSuccess();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true }));
    expect(mockMarkOnboarded).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('onboardingComplete')).toBeNull();
  });
});
