import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { SearchesPanel } from '../SearchesPanel';
import { postcodeService } from '../../../services/postcodeService';
import { groundsureService } from '../../../services/groundsure.service';
import { searchOrderService } from '../../../services/searchOrder.service';
import { onesearchService } from '../../../services/onesearch.service';
import { markExplainerSeen } from '../../explainer/explainerSeen';
import stripePaymentService from '@/services/stripePayment.service';
import type { LocalAuthorityInfo } from '../../../services/postcodeService';

/**
 * A failed search order used to be completely silent: the handler logged to
 * the console and unstuck the button, which looks exactly like a dead button.
 * A Groundsure order failed upstream for weeks in 2026-08 without anyone
 * seeing a thing, and the £0-price bug reached a live Stripe checkout because
 * nothing between the worker and the customer questioned the number.
 *
 * These tests assert the two properties that matter: the person is told, and
 * a bad price never reaches Stripe.
 */

vi.mock('../../../services/postcodeService', async () => {
  const actual =
    await vi.importActual<typeof import('../../../services/postcodeService')>(
      '../../../services/postcodeService',
    );
  return {
    ...actual,
    postcodeService: {
      ...actual.postcodeService,
      getLocalAuthorityInfo: vi.fn(),
      formatPostcode: (p: string) => p,
    },
  };
});

vi.mock('../../../services/groundsure.service', () => ({
  groundsureService: {
    placeOrderForProperty: vi.fn(),
    placeOrder: vi.fn(),
    getPrices: vi.fn(),
    getOrderStatus: vi.fn(),
  },
}));

vi.mock('../../../services/onesearch.service', () => ({
  onesearchService: { placeOrder: vi.fn(), getPrices: vi.fn(), requestProducts: vi.fn() },
}));

vi.mock('../../../services/searchOrder.service', () => ({
  searchOrderService: { createOrder: vi.fn(async () => ({ success: true, orderId: 'audit-row-1' })) },
}));

vi.mock('@/services/icp.service', () => ({
  icpService: { getUserPrincipal: vi.fn(async () => 'principal-test') },
}));

vi.mock('@/services/stripePayment.service', () => ({
  default: { prepareSearchCheckoutSession: vi.fn(), verifySession: vi.fn() },
}));

function laFixture(): LocalAuthorityInfo {
  return {
    postcode: 'SG19 1EX',
    adminDistrict: 'Central Bedfordshire',
    adminCounty: null,
    region: null,
    country: 'England',
    parish: null,
    ward: null,
    constituency: null,
    latitude: null,
    longitude: null,
    codes: { adminDistrict: null, adminCounty: null },
  };
}

function renderPanel() {
  return render(
    <MemoryRouter>
      <SearchesPanel
        postcode="SG19 1EX"
        transactionId="tx-test-1"
        transactionType="sale"
        partyName="Test Seller"
        partyEmail="seller@example.test"
        propertyAddress="14 London Road, Sandy"
        orderedBy="seller"
      />
    </MemoryRouter>,
  );
}

/** Open the Groundsure card, pick the cheapest bundle, hit Order. */
async function orderCheapestGroundsureBundle(): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: /Groundsure bundles/i }));
  fireEvent.click(await screen.findByRole('button', { name: /^Homescreen/i }));
  fireEvent.click(await screen.findByRole('button', { name: /^Order 1 search/i }));
}

describe('SearchesPanel — Groundsure order failures are visible', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    markExplainerSeen('searches', 'tx-test-1');
    vi.mocked(postcodeService.getLocalAuthorityInfo).mockResolvedValue(laFixture());
  });

  it('should refuse to check out when the worker stamps a zero price', async () => {
    // The 2026-08-29 defect. retailGbp 0 is finite, so the old guard passed it
    // through and Stripe accepted a £0.00 checkout.
    vi.mocked(groundsureService.placeOrderForProperty).mockResolvedValue({
      success: true,
      id: 'row-1',
      ourReference: 'ref-1',
      retailGbp: 0,
    });
    renderPanel();

    await orderCheapestGroundsureBundle();

    expect(await screen.findByRole('alert')).toHaveTextContent(/price we can.t charge/i);
    expect(stripePaymentService.prepareSearchCheckoutSession).not.toHaveBeenCalled();
  });

  it('should refuse a negative price too', async () => {
    vi.mocked(groundsureService.placeOrderForProperty).mockResolvedValue({
      success: true,
      id: 'row-1',
      retailGbp: -5,
    });
    renderPanel();

    await orderCheapestGroundsureBundle();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(stripePaymentService.prepareSearchCheckoutSession).not.toHaveBeenCalled();
  });

  it('should show the reason the worker gave when pricing fails outright', async () => {
    // What the live 403 looked like before the key was rotated, and what a
    // needs_estimate product looks like now.
    vi.mocked(groundsureService.placeOrderForProperty).mockResolvedValue({
      success: false,
      error: 'Groundsure would not price: hs (needs_estimate)',
    });
    renderPanel();

    await orderCheapestGroundsureBundle();

    expect(await screen.findByRole('alert')).toHaveTextContent(/needs_estimate/);
    expect(stripePaymentService.prepareSearchCheckoutSession).not.toHaveBeenCalled();
  });

  it('should say so when the checkout session itself cannot be opened', async () => {
    vi.mocked(groundsureService.placeOrderForProperty).mockResolvedValue({
      success: true,
      id: 'row-1',
      retailGbp: 166.68,
    });
    vi.mocked(stripePaymentService.prepareSearchCheckoutSession).mockRejectedValue(
      new Error('409 Refusing to create a checkout session with no price'),
    );
    renderPanel();

    await orderCheapestGroundsureBundle();

    expect(await screen.findByRole('alert')).toHaveTextContent(/Couldn.t open the payment page/i);
  });

  it('should unstick the order button so the person can retry', async () => {
    // The button says "Placing order…" while in flight. If a failure leaves it
    // there, the panel is wedged.
    vi.mocked(groundsureService.placeOrderForProperty).mockResolvedValue({
      success: true,
      id: 'row-1',
      retailGbp: 0,
    });
    renderPanel();

    await orderCheapestGroundsureBundle();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Order 1 search/i })).toBeEnabled();
    });
    expect(screen.queryByRole('button', { name: /Placing order/i })).not.toBeInTheDocument();
  });

  it('should refuse a price that rounds down to nothing', async () => {
    // 0.001 is a positive number, so a pounds-only `<= 0` guard lets it past —
    // and Math.round(0.001 * 100) is 0 pence. Same £0.00 checkout, longer route.
    vi.mocked(groundsureService.placeOrderForProperty).mockResolvedValue({
      success: true,
      id: 'row-1',
      retailGbp: 0.001,
    });
    renderPanel();

    await orderCheapestGroundsureBundle();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(stripePaymentService.prepareSearchCheckoutSession).not.toHaveBeenCalled();
  });

  it('should clear a previous failure when the person tries again', async () => {
    // A stale alert sitting above a now-working button is its own lie.
    vi.mocked(groundsureService.placeOrderForProperty).mockResolvedValueOnce({
      success: false,
      error: 'Groundsure would not price: hs (needs_estimate)',
    });
    vi.mocked(stripePaymentService.prepareSearchCheckoutSession).mockResolvedValue({
      sessionId: 'cs_test_1',
      url: 'https://stripe.test/checkout',
    });
    renderPanel();

    await orderCheapestGroundsureBundle();
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    vi.mocked(groundsureService.placeOrderForProperty).mockResolvedValue({
      success: true,
      id: 'row-2',
      retailGbp: 166.68,
    });
    fireEvent.click(screen.getByRole('button', { name: /^Order 1 search/i }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('should let a good price through to checkout unchanged', async () => {
    // The guard must not become a blanket refusal — Avista at £166.68 gross.
    vi.mocked(groundsureService.placeOrderForProperty).mockResolvedValue({
      success: true,
      id: 'row-1',
      ourReference: 'ref-1',
      retailGbp: 166.68,
    });
    vi.mocked(stripePaymentService.prepareSearchCheckoutSession).mockResolvedValue({
      sessionId: 'cs_test_1',
      url: 'https://stripe.test/checkout',
    });
    renderPanel();

    await orderCheapestGroundsureBundle();

    await waitFor(() => {
      expect(stripePaymentService.prepareSearchCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ productRef: 'groundsure:row-1' }),
      );
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});


describe('SearchesPanel — OneSearch order failures are visible', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    markExplainerSeen('searches', 'tx-test-1');
    vi.mocked(postcodeService.getLocalAuthorityInfo).mockResolvedValue(laFixture());
  });

  /** Open the OneSearch card and order the preselected pack. */
  async function orderOneSearchPack(): Promise<void> {
    fireEvent.click(await screen.findByRole('button', { name: /OneSearch/i }));
    fireEvent.click(await screen.findByRole('button', { name: /via OneSearch/i }));
  }

  it('should refuse to check out when the worker stamps a zero price', async () => {
    vi.mocked(onesearchService.placeOrder).mockResolvedValue({
      success: true,
      id: 'os-1',
      retailGbp: 0,
    });
    renderPanel();

    await orderOneSearchPack();

    expect(await screen.findByRole('alert')).toHaveTextContent(/price we can.t charge/i);
    expect(stripePaymentService.prepareSearchCheckoutSession).not.toHaveBeenCalled();
  });

  it('should show the reason when pricing fails outright', async () => {
    vi.mocked(onesearchService.placeOrder).mockResolvedValue({
      success: false,
      error: 'PISCES rejected the address',
    });
    renderPanel();

    await orderOneSearchPack();

    expect(await screen.findByRole('alert')).toHaveTextContent(/PISCES rejected the address/);
  });

  it('should clear a previous failure when the person tries again', async () => {
    // Regression: handleOneSearchOrder did not reset its error on retry, so a
    // stale alert sat above a button that had since started working.
    vi.mocked(onesearchService.placeOrder).mockResolvedValueOnce({
      success: false,
      error: 'PISCES rejected the address',
    });
    vi.mocked(stripePaymentService.prepareSearchCheckoutSession).mockResolvedValue({
      sessionId: 'cs_test_1',
      url: 'https://stripe.test/checkout',
    });
    renderPanel();

    await orderOneSearchPack();
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    vi.mocked(onesearchService.placeOrder).mockResolvedValue({
      success: true,
      id: 'os-2',
      retailGbp: 259.2,
    });
    fireEvent.click(screen.getByRole('button', { name: /via OneSearch/i }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});

describe('SearchesPanel — the audit row records intent, not a sale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    markExplainerSeen('searches', 'tx-test-1');
    vi.mocked(postcodeService.getLocalAuthorityInfo).mockResolvedValue(laFixture());
    vi.mocked(searchOrderService.createOrder).mockResolvedValue({ success: true, orderId: 'audit-row-1' });
  });

  it('writes the row as requested before payment and hands its id to the checkout to promote', async () => {
    vi.mocked(groundsureService.placeOrderForProperty).mockResolvedValue({ success: true, id: 'row-1', ourReference: 'ref-1', retailGbp: 166.68 });
    vi.mocked(stripePaymentService.prepareSearchCheckoutSession).mockResolvedValue({ sessionId: 'cs_1', url: 'https://checkout.stripe.com/c/pay/cs_1' });
    renderPanel();
    await orderCheapestGroundsureBundle();

    await waitFor(() => expect(searchOrderService.createOrder).toHaveBeenCalled());
    expect(vi.mocked(searchOrderService.createOrder).mock.calls[0][0]).toMatchObject({ status: 'requested', provider: 'groundsure' });
    await waitFor(() => expect(stripePaymentService.prepareSearchCheckoutSession).toHaveBeenCalled());
    expect(vi.mocked(stripePaymentService.prepareSearchCheckoutSession).mock.calls[0][0]).toMatchObject({ searchOrderId: 'audit-row-1' });
  });

  it('says ordered outright in demo mode, where nothing is owed and the panel confirms on the spot', async () => {
    vi.mocked(groundsureService.placeOrderForProperty).mockResolvedValue({ success: true, id: 'GS-MOCK-1', ourReference: 'ref-1', retailGbp: 166.68, mock: true });
    renderPanel();
    await orderCheapestGroundsureBundle();

    await waitFor(() => expect(searchOrderService.createOrder).toHaveBeenCalled());
    expect(vi.mocked(searchOrderService.createOrder).mock.calls[0][0]).toMatchObject({ status: 'ordered' });
    expect(stripePaymentService.prepareSearchCheckoutSession).not.toHaveBeenCalled();
  });

  it('still opens the checkout when the audit row could not be written, without an id to promote', async () => {
    vi.mocked(searchOrderService.createOrder).mockResolvedValue({ success: false, error: 'permission denied' });
    vi.mocked(groundsureService.placeOrderForProperty).mockResolvedValue({ success: true, id: 'row-1', ourReference: 'ref-1', retailGbp: 166.68 });
    vi.mocked(stripePaymentService.prepareSearchCheckoutSession).mockResolvedValue({ sessionId: 'cs_1', url: 'https://checkout.stripe.com/c/pay/cs_1' });
    renderPanel();
    await orderCheapestGroundsureBundle();

    await waitFor(() => expect(stripePaymentService.prepareSearchCheckoutSession).toHaveBeenCalled());
    expect(vi.mocked(stripePaymentService.prepareSearchCheckoutSession).mock.calls[0][0]).not.toHaveProperty('searchOrderId');
  });
});
