// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Searches on an assisted deal (spec docs/plans/2026-09-06-agent-crm-spec.md,
 * I3, R2.4): the agent sets the order up, the payment is the client's, the
 * order is recorded in the client's name, and there is no way past the step
 * without paying through the platform.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { SearchesPanel } from '../SearchesPanel';
import { postcodeService } from '../../../services/postcodeService';
import { groundsureService } from '../../../services/groundsure.service';
import { markExplainerSeen } from '../../explainer/explainerSeen';
import stripePaymentService from '@/services/stripePayment.service';
import { actingSidesFor, recordOnBehalf } from '@/services/onBehalf';
import { sendPaymentLink } from '@/services/delegation.service';
import { loadSearchPendingState, saveSearchPendingState } from '@/services/searchCheckoutResume';
import type { LocalAuthorityInfo } from '../../../services/postcodeService';
import type { DealSide } from '@/services/shareParty.service';

vi.mock('../../../services/postcodeService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/postcodeService')>('../../../services/postcodeService');
  return {
    ...actual,
    postcodeService: { ...actual.postcodeService, getLocalAuthorityInfo: vi.fn(), formatPostcode: (p: string) => p },
  };
});
vi.mock('../../../services/groundsure.service', () => ({
  groundsureService: { placeOrderForProperty: vi.fn(), placeOrder: vi.fn(), getPrices: vi.fn(), getOrderStatus: vi.fn() },
}));
vi.mock('../../../services/onesearch.service', () => ({
  onesearchService: { placeOrder: vi.fn(), getPrices: vi.fn(), requestProducts: vi.fn() },
}));
vi.mock('../../../services/searchOrder.service', () => ({
  searchOrderService: { createOrder: vi.fn(async () => ({ success: true })) },
}));
vi.mock('@/services/icp.service', () => ({ icpService: { getUserPrincipal: vi.fn(async () => 'principal-test') } }));
vi.mock('@/services/stripePayment.service', () => ({
  default: { prepareSearchCheckoutSession: vi.fn(), verifySession: vi.fn() },
}));
vi.mock('@/services/onBehalf', () => ({
  actingSidesFor: vi.fn(async () => [] as string[]),
  recordOnBehalf: vi.fn(async () => true),
  forgetActingFor: vi.fn(),
}));
vi.mock('@/services/delegation.service', () => {
  class DelegationError extends Error {
    constructor(public readonly code: string) {
      super(code);
    }
  }
  return { sendPaymentLink: vi.fn(), DelegationError };
});

function laFixture(): LocalAuthorityInfo {
  return {
    postcode: 'SG19 1EX', adminDistrict: 'Central Bedfordshire', adminCounty: null, region: null, country: 'England', parish: null,
    ward: null, constituency: null, latitude: null, longitude: null, codes: { adminDistrict: null, adminCounty: null },
  };
}

const onOrderComplete = vi.fn();

function renderPanel(): void {
  render(
    <MemoryRouter>
      <SearchesPanel
        postcode="SG19 1EX"
        transactionId="tx-test-1"
        transactionType="sale"
        partyName="Test Seller"
        partyEmail="seller@example.test"
        propertyAddress="14 London Road, Sandy"
        orderedBy="seller"
        onOrderComplete={onOrderComplete}
      />
    </MemoryRouter>,
  );
}

async function orderCheapestGroundsureBundle(): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: /Groundsure bundles/i }));
  fireEvent.click(await screen.findByRole('button', { name: /^Homescreen/i }));
  fireEvent.click(await screen.findByRole('button', { name: /^Order 1 search/i }));
}

describe('SearchesPanel on an assisted deal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    markExplainerSeen('searches', 'tx-test-1');
    vi.mocked(postcodeService.getLocalAuthorityInfo).mockResolvedValue(laFixture());
    vi.mocked(actingSidesFor).mockResolvedValue(['seller']);
    vi.mocked(groundsureService.placeOrderForProperty).mockResolvedValue({ success: true, id: 'row-1', ourReference: 'ref-1', retailGbp: 166.68 });
    vi.mocked(stripePaymentService.prepareSearchCheckoutSession).mockResolvedValue({
      sessionId: 'cs_test_1',
      url: 'https://checkout.stripe.com/c/pay/cs_test_1',
    });
  });

  it('bills the seller, hands the payment over instead of opening it, and has no way past the step without paying', async () => {
    renderPanel();
    expect(await screen.findByTestId('assisted-note')).toHaveTextContent('Ordering in the seller’s name');
    expect(screen.queryByRole('button', { name: /skip|elsewhere|already ordered|mark as ordered/i })).toBeNull();

    await orderCheapestGroundsureBundle();

    await waitFor(() => expect(stripePaymentService.prepareSearchCheckoutSession).toHaveBeenCalled());
    expect(vi.mocked(stripePaymentService.prepareSearchCheckoutSession).mock.calls[0][0]).toMatchObject({
      onBehalfOf: 'seller',
      transactionId: 'tx-test-1',
      productRef: 'groundsure:row-1',
    });
    const card = await screen.findByTestId('payment-handoff');
    expect(card).toHaveTextContent('£166.68 to Groundsure');
    expect(screen.getByRole('button', { name: 'Email the link to the seller' })).toBeEnabled();
    // The builders are out of the way while the client's payment is pending, so nothing can overwrite it.
    expect(screen.queryByTestId('assisted-note')).toBeNull();
    expect(screen.queryByRole('button', { name: /Groundsure bundles/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Choose a different order instead' }));
    expect(await screen.findByRole('button', { name: /Groundsure bundles/i })).toBeInTheDocument();
    expect(window.localStorage.getItem('propxchain.onesearch.pending')).toBeNull();
  });

  it('an order clicked before the mandate lookup has landed still ends at the hand-over, never on Stripe', async () => {
    let resolveSides: (sides: DealSide[]) => void = () => undefined;
    const pending = new Promise<DealSide[]>((resolve) => {
      resolveSides = resolve;
    });
    vi.mocked(actingSidesFor).mockImplementation(() => pending);
    renderPanel();
    await orderCheapestGroundsureBundle();
    await waitFor(() => expect(groundsureService.placeOrderForProperty).toHaveBeenCalled());
    expect(stripePaymentService.prepareSearchCheckoutSession).not.toHaveBeenCalled();
    resolveSides(['seller']);
    await waitFor(() => expect(stripePaymentService.prepareSearchCheckoutSession).toHaveBeenCalled());
    expect(vi.mocked(stripePaymentService.prepareSearchCheckoutSession).mock.calls[0][0]).toMatchObject({ onBehalfOf: 'seller', transactionId: 'tx-test-1' });
    expect(await screen.findByTestId('payment-handoff')).toBeInTheDocument();
  });

  it('a refresh while the client has the link brings the waiting hand-over back, with the link marked sent', async () => {
    saveSearchPendingState({
      provider: 'groundsure', transactionId: 'tx-test-1', searches: [], totalPence: 16668, ourReference: 'ref-1', sessionId: 'cs_test_1',
      onBehalfOf: 'seller', checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_1', linkSentTo: 's***r@example.test', startedAt: new Date().toISOString(),
    });
    vi.mocked(stripePaymentService.verifySession).mockRejectedValue(new Error('Payment not completed'));
    renderPanel();
    expect(await screen.findByTestId('payment-handoff')).toHaveTextContent('£166.68 to Groundsure');
    expect(screen.getByText(/Sent to/)).toHaveTextContent('s***r@example.test');
    expect(screen.queryByRole('button', { name: 'Choose a different order instead' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Send the link again' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Groundsure bundles/i })).toBeNull();
  });

  it('a paid session with no stash left on this device still settles from what Stripe says', async () => {
    saveSearchPendingState({
      provider: 'groundsure', transactionId: 'tx-test-1', searches: [], totalPence: 16668, ourReference: 'ref-1', sessionId: 'cs_test_1',
      onBehalfOf: 'seller', checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_1', linkSentTo: 's***r@example.test', startedAt: new Date().toISOString(),
    });
    vi.mocked(stripePaymentService.verifySession).mockRejectedValueOnce(new Error('Payment not completed'));
    renderPanel();
    await screen.findByTestId('payment-handoff');
    window.localStorage.clear();
    vi.mocked(stripePaymentService.verifySession).mockResolvedValueOnce({
      verified: true, principalId: 'principal-test', tier: '', amountPaid: 16668, sessionId: 'cs_test_1', type: 'search',
      provider: 'groundsure', onBehalfOf: 'seller', payerUserSub: 'client-1', transactionId: 'tx-test-1',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Check payment' }));
    expect(await screen.findByText('Searches Ordered')).toBeInTheDocument();
    expect(screen.getByTestId('paid-by')).toHaveTextContent('the seller, in their own name');
    expect(onOrderComplete).toHaveBeenCalledTimes(1);
    expect(recordOnBehalf).toHaveBeenCalledWith('tx-test-1', 'seller', 'order_searches', 'groundsure');
  });

  it('a failed check is reported as a failed check, not as unpaid', async () => {
    vi.mocked(sendPaymentLink).mockResolvedValue({ sentTo: 's***r@example.test', amountPence: 16668 });
    renderPanel();
    await orderCheapestGroundsureBundle();
    fireEvent.click(await screen.findByRole('button', { name: 'Email the link to the seller' }));
    await screen.findByText(/Sent to/);
    vi.mocked(stripePaymentService.verifySession).mockRejectedValueOnce(new Error('Failed to verify session'));
    fireEvent.click(screen.getByRole('button', { name: 'Check payment' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Could not check just now');
  });

  it('an expired payment page goes back to the builders with the reason showing', async () => {
    const { DelegationError } = await import('@/services/delegation.service');
    vi.mocked(sendPaymentLink).mockRejectedValue(new DelegationError('session_not_open'));
    renderPanel();
    await orderCheapestGroundsureBundle();
    fireEvent.click(await screen.findByRole('button', { name: 'Email the link to the seller' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/expired/i);
    expect(await screen.findByRole('button', { name: /Groundsure bundles/i })).toBeInTheDocument();
    expect(screen.queryByTestId('payment-handoff')).toBeNull();
  });

  it('emails the seller the link, then settles the order in their name once they have paid', async () => {
    vi.mocked(sendPaymentLink).mockResolvedValue({ sentTo: 's***r@example.test', amountPence: 16668 });
    renderPanel();
    await orderCheapestGroundsureBundle();
    fireEvent.click(await screen.findByRole('button', { name: 'Email the link to the seller' }));

    await waitFor(() => expect(sendPaymentLink).toHaveBeenCalledWith({
      transactionId: 'tx-test-1', role: 'seller', sessionId: 'cs_test_1', propertyAddress: '14 London Road, Sandy',
    }));
    expect(await screen.findByText(/Sent to/)).toHaveTextContent('s***r@example.test');
    expect(loadSearchPendingState()?.linkSentTo).toBe('s***r@example.test');
    // The client may now pay that link, so the agent cannot abandon it from here.
    expect(screen.queryByRole('button', { name: 'Choose a different order instead' })).toBeNull();

    vi.mocked(stripePaymentService.verifySession).mockRejectedValueOnce(new Error('Payment not completed'));
    fireEvent.click(screen.getByRole('button', { name: 'Check payment' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Not paid yet');
    expect(onOrderComplete).not.toHaveBeenCalled();

    vi.mocked(stripePaymentService.verifySession).mockResolvedValueOnce({
      verified: true, principalId: 'principal-test', tier: '', amountPaid: 16668, sessionId: 'cs_test_1', type: 'search',
      onBehalfOf: 'seller', payerUserSub: 'client-1', transactionId: 'tx-test-1',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Check payment' }));

    expect(await screen.findByText('Searches Ordered')).toBeInTheDocument();
    expect(screen.getByTestId('paid-by')).toHaveTextContent('the seller, in their own name');
    expect(onOrderComplete).toHaveBeenCalledTimes(1);
    expect(recordOnBehalf).toHaveBeenCalledWith('tx-test-1', 'seller', 'order_searches', 'groundsure');
  });

  it('explains a refused link rather than failing silently', async () => {
    const { DelegationError } = await import('@/services/delegation.service');
    vi.mocked(sendPaymentLink).mockRejectedValue(new DelegationError('client_has_no_email'));
    renderPanel();
    await orderCheapestGroundsureBundle();
    fireEvent.click(await screen.findByRole('button', { name: 'Email the link to the seller' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/no email address/i);
  });

  it("a party's own order is untouched: no note, no hand-over, no mandate on the session", async () => {
    vi.mocked(actingSidesFor).mockResolvedValue([]);
    renderPanel();
    await screen.findByRole('button', { name: /Groundsure bundles/i });
    expect(screen.queryByTestId('assisted-note')).toBeNull();
    await orderCheapestGroundsureBundle();
    await waitFor(() => expect(stripePaymentService.prepareSearchCheckoutSession).toHaveBeenCalled());
    const params = vi.mocked(stripePaymentService.prepareSearchCheckoutSession).mock.calls[0][0];
    expect(params).not.toHaveProperty('onBehalfOf');
    expect(screen.queryByTestId('payment-handoff')).toBeNull();
  });
});
