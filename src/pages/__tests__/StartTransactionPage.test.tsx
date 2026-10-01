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

let mockKinds: string[] = [];
vi.mock('@/components/navigation/usePortalSections', () => ({
  usePortalKinds: () => mockKinds,
}));

import StartTransactionPage from '../StartTransactionPage';

function renderPage(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/start-transaction']}>
      <StartTransactionPage />
    </MemoryRouter>,
  );
}

describe('StartTransactionPage — buying or selling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockKinds = [];
  });

  it('should ask an estate agent whether they act for a seller, with no buying/selling picker', () => {
    mockKinds = ['agent'];
    renderPage();

    expect(screen.getByText('Are you acting for a seller?')).toBeInTheDocument();
    expect(screen.queryByText(/are you buying or selling\?/i)).not.toBeInTheDocument();
  });

  it('should ask everyone else buying or selling straight away, with no plan or £75 price shown', () => {
    mockKinds = ['developer', 'conveyancer'];
    renderPage();

    expect(screen.getByText(/are you buying or selling\?/i)).toBeInTheDocument();
    expect(screen.getByText('Free, no platform fee')).toBeInTheDocument();
    expect(screen.queryByText(/£75/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /premium/i })).not.toBeInTheDocument();
  });

  it('should not shortcut a stale buyer onboardingRole: the question is always asked', () => {
    // authStore stamps onboardingRole from account metadata on every login.
    localStorage.setItem('onboardingRole', 'buyer');
    renderPage();

    expect(screen.getByText(/are you buying or selling\?/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should send a buyer to /join on the free path', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /continue as buyer/i }));

    expect(localStorage.getItem('pendingTier')).toBe('starter');
    expect(localStorage.getItem('onboardingRole')).toBe('buyer');
    expect(mockNavigate).toHaveBeenCalledWith('/join');
  });

  it('should send a seller to /create-transaction on the free path', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /continue as seller/i }));

    expect(localStorage.getItem('pendingTier')).toBe('starter');
    expect(localStorage.getItem('onboardingRole')).toBe('seller');
    expect(mockNavigate).toHaveBeenCalledWith('/create-transaction');
  });
});
