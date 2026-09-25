// PropXchain — SPDX-License-Identifier: Proprietary
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// The sidebar pulls in auth/routing state we don't care about here.
vi.mock('@/components/navigation/AppTopBar', () => ({
  default: () => null,
}));

import StartTransactionPage from '../StartTransactionPage';

function renderPage(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/start-transaction']}>
      <StartTransactionPage />
    </MemoryRouter>,
  );
}

describe('StartTransactionPage — tier + role routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should show the Buying/Selling picker when Starter is clicked even if onboardingRole is a stale buyer', () => {
    // authStore stamps onboardingRole from account metadata on every login, so a
    // buyer-role account arriving from the dashboard must NOT be shortcut to /join.
    localStorage.setItem('onboardingRole', 'buyer');
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /continue with starter/i }));

    expect(screen.getByText(/are you buying or selling\?/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalledWith('/join');
  });

  it('should route Premium straight to the create-transaction flow', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /continue with premium/i }));

    expect(localStorage.getItem('pendingTier')).toBe('premium');
    expect(mockNavigate).toHaveBeenCalledWith('/create-transaction');
  });

  it('should send a Starter buyer to /join after they pick a role', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /continue with starter/i }));

    fireEvent.click(screen.getByRole('button', { name: /continue as buyer/i }));

    expect(localStorage.getItem('pendingTier')).toBe('starter');
    expect(localStorage.getItem('onboardingRole')).toBe('buyer');
    expect(mockNavigate).toHaveBeenCalledWith('/join');
  });

  it('should send a Starter seller to /create-transaction after they pick a role', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /continue with starter/i }));

    fireEvent.click(screen.getByRole('button', { name: /continue as seller/i }));

    expect(localStorage.getItem('pendingTier')).toBe('starter');
    expect(localStorage.getItem('onboardingRole')).toBe('seller');
    expect(mockNavigate).toHaveBeenCalledWith('/create-transaction');
  });
});
