// PropXchain — SPDX-License-Identifier: Proprietary
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/services/stripePayment.service', () => ({
  default: {
    prepareChainUnlockCheckoutSession: vi.fn(),
    verifySession: vi.fn(),
  },
}));

import stripePaymentService from '@/services/stripePayment.service';
import { ChainUnlockButton } from '../ChainUnlockButton';

const PENDING_KEY = 'propxchain.vmc.chain.pending';
const TRANSACTION_ID = 'tx-123';
const PRINCIPAL_ID = 'principal-abc';

function setLocationSearch(search: string): void {
  const url = new URL(window.location.href);
  url.search = search;
  window.history.replaceState({}, '', url.toString());
}

describe('ChainUnlockButton', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setLocationSearch('');
  });

  afterEach(() => {
    // @ts-expect-error partial mock — restoring the real Location
    window.location = originalLocation;
    localStorage.clear();
  });

  it('renders the CTA and starts checkout on click', async () => {
    vi.mocked(stripePaymentService.prepareChainUnlockCheckoutSession).mockResolvedValue({
      sessionId: 'cs_test_1',
      url: 'https://checkout.stripe.com/pay/cs_test_1',
    });

    // @ts-expect-error partial mock — only href is exercised by handleClick
    delete window.location;
    // @ts-expect-error partial mock
    window.location = { ...originalLocation, href: '' };

    render(
      <ChainUnlockButton
        transactionId={TRANSACTION_ID}
        principalId={PRINCIPAL_ID}
        onUnlocked={() => {}}
      />,
    );

    const button = screen.getByRole('button', { name: /Unlock live chain — £25/i });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);

    await waitFor(() =>
      expect(stripePaymentService.prepareChainUnlockCheckoutSession).toHaveBeenCalledWith({
        principalId: PRINCIPAL_ID,
        transactionId: TRANSACTION_ID,
      }),
    );

    await waitFor(() => expect(window.location.href).toBe('https://checkout.stripe.com/pay/cs_test_1'));

    const pending = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null');
    expect(pending).toMatchObject({ transactionId: TRANSACTION_ID, sessionId: 'cs_test_1' });
  });

  it('shows an error and does not navigate when checkout setup fails', async () => {
    vi.mocked(stripePaymentService.prepareChainUnlockCheckoutSession).mockRejectedValue(
      new Error('Worker unavailable'),
    );

    render(
      <ChainUnlockButton
        transactionId={TRANSACTION_ID}
        principalId={PRINCIPAL_ID}
        onUnlocked={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Unlock live chain — £25/i }));

    await waitFor(() => expect(screen.getByText('Worker unavailable')).toBeInTheDocument());
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it('resumes after redirect: verifies the session and calls onUnlocked on a confirmed chain-unlock', async () => {
    localStorage.setItem(
      PENDING_KEY,
      JSON.stringify({
        transactionId: TRANSACTION_ID,
        startedAt: new Date().toISOString(),
        sessionId: 'cs_test_resume',
      }),
    );
    setLocationSearch('?vmc_stripe_session_id=cs_test_resume');
    vi.mocked(stripePaymentService.verifySession).mockResolvedValue({
      verified: true,
      type: 'chain-unlock',
      principalId: PRINCIPAL_ID,
      tier: 'chain-unlock',
      amountPaid: 2500,
      sessionId: 'cs_test_resume',
    });

    const onUnlocked = vi.fn();
    render(
      <ChainUnlockButton
        transactionId={TRANSACTION_ID}
        principalId={PRINCIPAL_ID}
        onUnlocked={onUnlocked}
      />,
    );

    await waitFor(() =>
      expect(stripePaymentService.verifySession).toHaveBeenCalledWith('cs_test_resume'),
    );
    await waitFor(() => expect(onUnlocked).toHaveBeenCalledTimes(1));

    // Pending state and the return param are both cleared once confirmed.
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it('treats an unverified result on the passive orphan-resume path as not-paid-yet, not an error (abandoned checkout)', async () => {
    // Pending stash from a previous visit, but no ?vmc_stripe_session_id —
    // this mount is a later, unrelated visit to the transaction page, not a
    // fresh return from Stripe (the user may simply have abandoned checkout).
    localStorage.setItem(
      PENDING_KEY,
      JSON.stringify({
        transactionId: TRANSACTION_ID,
        startedAt: new Date().toISOString(),
        sessionId: 'cs_test_abandoned',
      }),
    );
    setLocationSearch('');
    vi.mocked(stripePaymentService.verifySession).mockResolvedValue({
      verified: false,
      principalId: PRINCIPAL_ID,
      tier: 'chain-unlock',
      amountPaid: 0,
      sessionId: 'cs_test_abandoned',
      type: 'chain-unlock',
    });

    const onUnlocked = vi.fn();
    render(
      <ChainUnlockButton
        transactionId={TRANSACTION_ID}
        principalId={PRINCIPAL_ID}
        onUnlocked={onUnlocked}
      />,
    );

    await waitFor(() =>
      expect(stripePaymentService.verifySession).toHaveBeenCalledWith('cs_test_abandoned'),
    );

    // No scary persistent error banner for a user who simply abandoned checkout.
    expect(screen.queryByText(/Payment could not be confirmed/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Unlock live chain — £25/i })).not.toBeDisabled();
    expect(onUnlocked).not.toHaveBeenCalled();
    // No double-verifySession — same rule M2 established for confirm().
    expect(stripePaymentService.verifySession).toHaveBeenCalledTimes(1);
  });

  it('does not resume when the pending transactionId does not match the current transaction', async () => {
    localStorage.setItem(
      PENDING_KEY,
      JSON.stringify({
        transactionId: 'some-other-tx',
        startedAt: new Date().toISOString(),
        sessionId: 'cs_test_other',
      }),
    );
    setLocationSearch('?vmc_stripe_session_id=cs_test_other');

    const onUnlocked = vi.fn();
    render(
      <ChainUnlockButton
        transactionId={TRANSACTION_ID}
        principalId={PRINCIPAL_ID}
        onUnlocked={onUnlocked}
      />,
    );

    await waitFor(() => expect(screen.getByRole('button')).not.toBeDisabled());
    expect(stripePaymentService.verifySession).not.toHaveBeenCalled();
    expect(onUnlocked).not.toHaveBeenCalled();
  });
});
