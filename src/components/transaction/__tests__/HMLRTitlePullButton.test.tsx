// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The £7 title pull is shared by Stage 1 and the Sales pack row. These pin the
 * checkout it starts (tier, amount, pending state), the double-click guard and
 * the return path: verify → pull → clear, refund on failure, and the resume
 * claim that stops a second mounted button repeating any of it.
 * Every payment call is mocked: no test reaches Stripe, HMLR or the worker.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'jwt-test' } } }) } },
}));

import stripePaymentService from '@/services/stripePayment.service';
import { hmlrTitleService, type HmlrTitlePullResult } from '@/services/hmlrTitle.service';
import { HMLR_PENDING_KEY, releaseResume, savePendingState } from '@/services/hmlrPullPending';
import HMLRTitlePullButton from '../HMLRTitlePullButton';

const prepare = vi.mocked(stripePaymentService.prepareCheckoutSession);
const verify = vi.mocked(stripePaymentService.verifySession);
const pull = vi.mocked(hmlrTitleService.pullTitleRegister);
const findPull = vi.mocked(hmlrTitleService.findPullByTitleNumber);
const fetchMock = vi.fn();

const PAID = { verified: true, tier: 'hmlr-pull' } as Awaited<ReturnType<typeof stripePaymentService.verifySession>>;
const PULLED = { register: {}, responseHash: 'h', canisterDocId: 'd', warnings: [] } as unknown as HmlrTitlePullResult;

function savePaidPending(transactionId = 'tx-1'): void {
  savePendingState({ titleNumber: 'GR506405', transactionId, startedAt: new Date().toISOString(), sessionId: 'cs_test_paid' });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // The claim is module state; a test that leaves a resume hanging must not block the next.
  ['tx-1', 'tx-9'].forEach(releaseResume);
  window.history.replaceState({}, '', '/transaction/tx-1/flow');
  vi.stubEnv('VITE_PAYMENT_WORKER_URL', 'https://payment-worker.test');
  fetchMock.mockResolvedValue({ ok: true } as Response);
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
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

  it('should not verify again when "Resume pending title pull" is clicked during a mount-time resume', async () => {
    // The mount-time resume holds the claim while it waits on verifySession,
    // before any status change disables the button.
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
    expect(callsAfterMount).toBe(1);
    expect(verify).toHaveBeenCalledTimes(1);
    expect(prepare).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Confirming payment…');
    expect(localStorage.getItem(HMLR_PENDING_KEY)).not.toBeNull();
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

describe('HMLRTitlePullButton return from Stripe', () => {
  it('should verify, pull and clear the pending record when the URL carries the session', async () => {
    savePaidPending();
    window.history.replaceState({}, '', '/transaction/tx-1/flow?hmlr_stripe_session_id=cs_test_paid');
    verify.mockResolvedValue(PAID);
    pull.mockResolvedValue(PULLED);
    const onSuccess = vi.fn();
    render(<HMLRTitlePullButton titleNumber="GR506405" transactionId="tx-1" onSuccess={onSuccess} />);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(PULLED));
    expect(verify).toHaveBeenCalledWith('cs_test_paid');
    expect(pull).toHaveBeenCalledWith('GR506405', 'tx-1', { stripeSessionId: 'cs_test_paid' });
    expect(localStorage.getItem(HMLR_PENDING_KEY)).toBeNull();
    expect(window.location.search).toBe('');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should resume a paid orphan with no URL param and pull exactly once', async () => {
    savePaidPending();
    verify.mockResolvedValue(PAID);
    pull.mockResolvedValue(PULLED);
    const onSuccess = vi.fn();
    render(<HMLRTitlePullButton titleNumber="GR506405" transactionId="tx-1" onSuccess={onSuccess} />);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(pull).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(HMLR_PENDING_KEY)).toBeNull();
  });

  it('should leave an unpaid orphan pending and pull nothing', async () => {
    savePaidPending();
    verify.mockRejectedValue(new Error('not paid'));
    render(<HMLRTitlePullButton titleNumber="GR506405" transactionId="tx-1" />);
    await waitFor(() => expect(verify).toHaveBeenCalledTimes(1));
    expect(pull).not.toHaveBeenCalled();
    expect(localStorage.getItem(HMLR_PENDING_KEY)).not.toBeNull();
    expect(await screen.findByRole('button', { name: 'Resume pending title pull' })).toBeEnabled();
  });

  it('should refund the session and say so when the pull fails', async () => {
    savePaidPending();
    window.history.replaceState({}, '', '/transaction/tx-1/flow?hmlr_stripe_session_id=cs_test_paid');
    verify.mockResolvedValue(PAID);
    pull.mockRejectedValue(new Error('HMLR timed out'));
    render(<HMLRTitlePullButton titleNumber="GR506405" transactionId="tx-1" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://payment-worker.test/refund-session');
    expect(JSON.parse(String(init.body))).toEqual({ sessionId: 'cs_test_paid' });
    expect(await screen.findByText("Title report couldn't be generated")).toBeInTheDocument();
    expect(screen.queryByText(/refund did not\s+complete/)).toBeNull();
    expect(localStorage.getItem(HMLR_PENDING_KEY)).toBeNull();
  });

  it('should show the manual-refund warning when the refund call fails', async () => {
    savePaidPending();
    window.history.replaceState({}, '', '/transaction/tx-1/flow?hmlr_stripe_session_id=cs_test_paid');
    verify.mockResolvedValue(PAID);
    pull.mockRejectedValue(new Error('HMLR timed out'));
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);
    render(<HMLRTitlePullButton titleNumber="GR506405" transactionId="tx-1" />);
    expect(await screen.findByText(/refund did not\s+complete/)).toBeInTheDocument();
  });

  it('should not verify, pull or refund again from a second button mounted mid-resume', async () => {
    savePaidPending();
    verify.mockResolvedValue(PAID);
    let finishPull: (r: HmlrTitlePullResult) => void = () => undefined;
    pull.mockReturnValue(new Promise((resolve) => { finishPull = resolve; }));
    // First button (say the pack row) starts the resume, then the seller
    // switches tab: it unmounts but its resume runs on.
    const first = render(<HMLRTitlePullButton variant="compact" titleNumber="GR506405" transactionId="tx-1" />);
    await waitFor(() => expect(pull).toHaveBeenCalledTimes(1));
    const verifyCalls = verify.mock.calls.length;
    first.unmount();

    // Second button (Stage 1 in edit) mounts while the pull is in flight.
    render(<HMLRTitlePullButton titleNumber="GR506405" transactionId="tx-1" />);
    const waiting = await screen.findByRole('button', { name: 'Confirming payment…' });
    expect(waiting).toBeDisabled();
    fireEvent.click(waiting);
    expect(verify).toHaveBeenCalledTimes(verifyCalls);
    expect(pull).toHaveBeenCalledTimes(1);
    expect(prepare).not.toHaveBeenCalled();

    // The first resume lands: the second button now offers a free view.
    findPull.mockResolvedValue({ title_number: 'GR506405' } as unknown as Awaited<ReturnType<typeof findPull>>);
    await act(async () => {
      finishPull(PULLED);
    });
    expect(await screen.findByRole('button', { name: 'View existing Title' })).toBeEnabled();
    expect(verify).toHaveBeenCalledTimes(verifyCalls);
    expect(pull).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem(HMLR_PENDING_KEY)).toBeNull();
  });

  it('should refuse to send the seller to pay when the pending record cannot be saved', async () => {
    prepare.mockResolvedValue({ sessionId: 'cs_test_3', url: '#stripe' });
    const setItem = vi.fn(() => {
      throw new Error('QuotaExceededError');
    });
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem,
      removeItem: () => undefined,
      clear: () => undefined,
    });
    render(<HMLRTitlePullButton titleNumber="GR506405" transactionId="tx-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Get Title Report — £7' }));
    expect(await screen.findByText(/Payment setup failed/)).toBeInTheDocument();
    expect(window.location.hash).not.toBe('#stripe');
    expect(setItem).toHaveBeenCalled();
  });
});
