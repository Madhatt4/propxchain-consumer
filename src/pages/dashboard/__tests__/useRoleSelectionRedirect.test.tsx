// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

const adminState = { isAdmin: false, isLoading: false, isError: false, role: null };
vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => adminState }));

import { useAuthStore } from '@/stores/authStore';
import { useRoleSelectionRedirect, ROLE_SELECTION_PATH, type TransactionsLoadState } from '../useRoleSelectionRedirect';

const loadedNoTransactions: TransactionsLoadState = {
  transactionsLoaded: true,
  transactionsLoading: false,
  transactionsError: null,
  transactionCount: 0,
};

function signIn(metadata: Record<string, unknown>, authMethod: 'supabase' | 'ii' = 'supabase'): void {
  useAuthStore.setState({
    principalId: 'principal-test',
    isAuthenticated: true,
    authMethod,
    supabaseUser: authMethod === 'supabase'
      ? ({ id: 'user-1', user_metadata: metadata } as never)
      : null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  adminState.isAdmin = false;
  adminState.isLoading = false;
  adminState.isError = false;
});

describe('useRoleSelectionRedirect', () => {
  it('should redirect a new user who needs onboarding and has no transactions', () => {
    signIn({ propxchain_needs_onboarding: true });

    renderHook(() => useRoleSelectionRedirect(loadedNoTransactions));

    expect(mockNavigate).toHaveBeenCalledWith(ROLE_SELECTION_PATH);
  });

  it('should not redirect while the admin check is loading, nor once it says admin', () => {
    signIn({ propxchain_needs_onboarding: true });
    adminState.isLoading = true;
    const { rerender } = renderHook(() => useRoleSelectionRedirect(loadedNoTransactions));
    expect(mockNavigate).not.toHaveBeenCalled();

    adminState.isLoading = false;
    adminState.isAdmin = true;
    rerender();

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should not redirect before transactions have loaded, nor once one has arrived', () => {
    signIn({ propxchain_needs_onboarding: true });
    let tx: TransactionsLoadState = { ...loadedNoTransactions, transactionsLoaded: false };
    const { rerender } = renderHook(() => useRoleSelectionRedirect(tx));
    expect(mockNavigate).not.toHaveBeenCalled();

    tx = { ...loadedNoTransactions, transactionCount: 1 };
    rerender();

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should not redirect when the admin check failed', () => {
    signIn({ propxchain_needs_onboarding: true });
    adminState.isError = true;

    renderHook(() => useRoleSelectionRedirect(loadedNoTransactions));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should not redirect a buyer who has a transaction but no onboarded flag', () => {
    signIn({ role: 'buyer', propxchain_needs_onboarding: true });

    renderHook(() => useRoleSelectionRedirect({ ...loadedNoTransactions, transactionCount: 1 }));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should not redirect when the transactions load failed', () => {
    signIn({ propxchain_needs_onboarding: true });

    renderHook(() => useRoleSelectionRedirect({ ...loadedNoTransactions, transactionsError: 'boom' }));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should not redirect anyone on the legacy localStorage needsOnboarding flag alone', () => {
    localStorage.setItem('needsOnboarding', 'true');
    signIn({ role: 'developer' });

    renderHook(() => useRoleSelectionRedirect(loadedNoTransactions));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should remove the legacy onboarding keys from localStorage on mount', () => {
    localStorage.setItem('needsOnboarding', 'true');
    localStorage.setItem('onboardingComplete', 'true');
    signIn({});

    renderHook(() => useRoleSelectionRedirect(loadedNoTransactions));

    expect(localStorage.getItem('needsOnboarding')).toBeNull();
    expect(localStorage.getItem('onboardingComplete')).toBeNull();
  });

  it('should never redirect an Internet Identity user', () => {
    signIn({}, 'ii');

    renderHook(() => useRoleSelectionRedirect(loadedNoTransactions));

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
