// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The £7 title pull is shared by Stage 1 and the Sales pack row. These pin the
 * checkout it starts (tier, amount, pending state) and the double-click guard.
 * Every payment call is mocked: no test reaches Stripe.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

vi.mock('@/services/icp.service', () => ({
  icpService: { getUserPrincipal: vi.fn().mockResolvedValue('principal-1') },
}));
vi.mock('@/services/hmlrTitle.service', () => ({
  HmlrPullError: class HmlrPullError extends Error {},
  hmlrTitleService: {
    hasCompletedPull: vi.fn(() => false),
    findPullByTitleNumber: vi.fn().mockResolvedValue(null),
    loadExistingTitlePull: vi.fn().mockResolvedValue(null),
    loadPullByIndexRow: vi.fn().mockResolvedValue(null),
    pullTitleRegister: vi.fn(),
  },
}));
vi.mock('@/services/stripePayment.service', () => ({
  default: { prepareCheckoutSession: vi.fn(), verifySession: vi.fn() },
}));
vi.mock('@/components/documents/HMLRRegisterView', () => ({ default: () => null }));
vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: vi.fn() } } }));

import stripePaymentService from '@/services/stripePayment.service';
import { HMLR_PENDING_KEY, savePendingState } from '@/services/hmlrPullPending';
import HMLRTitlePullButton from '../HMLRTitlePullButton';

const prepare = vi.mocked(stripePaymentService.prepareCheckoutSession);
const verify = vi.mocked(stripePaymentService.verifySession);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('HMLRTitlePullButton (Stage 1)', () => {
  it('should keep the Stage 1 label and start the £7 hmlr-pull checkout', async () => {
    prepare.mockResolvedValue({ sessionId: 'cs_test_1', url: '#stripe' });
    render(<HMLRTitlePullButton titleNumber="gr506405" transactionId="tx-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Get Title Report — £7' }));
    await waitFor(() => expect(prepare).toHaveBeenCalledTimes(1));
    expect(prepare).toHaveBeenCalledWith({ principalId: 'principal-1', tier: 'hmlr-pull', amount: 7 });
    await waitFor(() => expect(localStorage.getItem(HMLR_PENDING_KEY)).not.toBeNull());
    expect(JSON.parse(localStorage.getItem(HMLR_PENDING_KEY) ?? '{}')).toMatchObject({
      titleNumber: 'GR506405',
      transactionId: 'tx-1',
      sessionId: 'cs_test_1',
    });
  });

  it('should disable the button while checkout is being prepared', async () => {
    prepare.mockReturnValue(new Promise(() => undefined));
    render(<HMLRTitlePullButton titleNumber="GR506405" transactionId="tx-1" />);
    const button = screen.getByRole('button', { name: 'Get Title Report — £7' });
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveTextContent('Redirecting to payment…');
    fireEvent.click(button);
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it('should not start a second verification when clicked twice while resuming a pending pull', async () => {
    // The resume branch awaits verifySession before any status change, so
    // only the in-flight guard stops the second click.
    verify.mockReturnValue(new Promise(() => undefined));
    savePendingState({
      titleNumber: 'GR506405',
      transactionId: 'tx-1',
      startedAt: new Date().toISOString(),
      sessionId: 'cs_test_old',
    });
    render(<HMLRTitlePullButton titleNumber="GR506405" transactionId="tx-1" />);
    const button = await screen.findByRole('button', { name: 'Resume pending title pull' });
    const callsAfterMount = verify.mock.calls.length;
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    expect(verify.mock.calls.length - callsAfterMount).toBe(1);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('should refuse a malformed title number without opening checkout', () => {
    render(<HMLRTitlePullButton titleNumber="12345" transactionId="tx-1" />);
    expect(screen.getByRole('button', { name: 'Get Title Report — £7' })).toBeDisabled();
    expect(screen.getByText(/Title number format looks wrong/)).toBeInTheDocument();
    expect(prepare).not.toHaveBeenCalled();
  });
});

describe('HMLRTitlePullButton compact (Sales pack row)', () => {
  it('should read "Get it for £7" and start the same checkout', async () => {
    prepare.mockResolvedValue({ sessionId: 'cs_test_2', url: '#stripe' });
    render(<HMLRTitlePullButton variant="compact" titleNumber="GR506405" transactionId="tx-9" />);
    fireEvent.click(screen.getByRole('button', { name: 'Get it for £7' }));
    await waitFor(() => expect(prepare).toHaveBeenCalledWith({ principalId: 'principal-1', tier: 'hmlr-pull', amount: 7 }));
  });
});
