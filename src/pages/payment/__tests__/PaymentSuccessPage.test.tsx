// PropXchain — SPDX-License-Identifier: Proprietary
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

vi.mock('@/services/icp.service', () => ({
  icpService: { transactionManager: { createTransactionWithInvite: vi.fn() } },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }) } },
}));

vi.mock('@/utils/rightmoveStorage', () => ({ claimPendingRightmoveData: vi.fn() }));

const mockLoadOneSearchPendingState = vi.fn();
vi.mock('@/services/searchCheckoutResume', () => ({
  loadOneSearchPendingState: () => mockLoadOneSearchPendingState(),
}));

vi.mock('@/stores/authStore', () => {
  const state = { isInitialized: true, principalId: 'principal-abc' };
  const useAuthStore = Object.assign(
    (selector: (s: typeof state) => unknown) => selector(state),
    { getState: () => state },
  );
  return { useAuthStore };
});

import PaymentSuccessPage from '../PaymentSuccessPage';

const CHAIN_PENDING_KEY = 'propxchain.vmc.chain.pending';

function renderAt(search: string): ReturnType<typeof render> {
  // PaymentSuccessPage reads the query string via useSearchParams(), which is
  // bound to the router's own location — MemoryRouter keeps an in-memory
  // history stack and does NOT read from window.location/history, so the URL
  // must be seeded via initialEntries (unlike AuthCallback, which parses
  // window.location.search directly and so tolerates window.history.pushState).
  return render(
    <MemoryRouter initialEntries={[`/payment/success${search}`]}>
      <PaymentSuccessPage />
    </MemoryRouter>,
  );
}

describe('PaymentSuccessPage — chain-unlock routing (C1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockLoadOneSearchPendingState.mockReturnValue(null);
  });

  it('routes a chain-unlock payment back to the transaction page with vmc_stripe_session_id instead of /dashboard', async () => {
    localStorage.setItem(
      CHAIN_PENDING_KEY,
      JSON.stringify({
        transactionId: 'tx-42',
        startedAt: new Date().toISOString(),
        sessionId: 'cs_test_chain',
      }),
    );
    mockVerifySession.mockResolvedValue({
      verified: true,
      type: 'chain-unlock',
      principalId: 'principal-abc',
      tier: 'chain-unlock',
      amountPaid: 2500,
      sessionId: 'cs_test_chain',
    });

    renderAt('?session_id=cs_test_chain');

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        '/transaction/tx-42?vmc_stripe_session_id=cs_test_chain',
        { replace: true },
      ),
    );
    // The dead-end regression this guards against: must NEVER fall through to /dashboard.
    expect(mockNavigate).not.toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it('falls back to /dashboard when a chain-unlock payment has no pending state on this device', async () => {
    mockVerifySession.mockResolvedValue({
      verified: true,
      type: 'chain-unlock',
      principalId: 'principal-abc',
      tier: 'chain-unlock',
      amountPaid: 2500,
      sessionId: 'cs_test_chain',
    });

    renderAt('?session_id=cs_test_chain');

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true }),
    );
  });
});
