import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { SearchesPanel } from '../SearchesPanel';
import { postcodeService } from '../../../services/postcodeService';
import { groundsureService } from '../../../services/groundsure.service';
import { searchOrderService } from '../../../services/searchOrder.service';
import { markExplainerSeen } from '../../explainer/explainerSeen';
import stripePaymentService from '@/services/stripePayment.service';
import type { LocalAuthorityInfo } from '../../../services/postcodeService';

/**
 * Groundsure prices per property, and can decline a line for a site — a
 * regional search off its patch, or an outline outside every price band. The
 * worker used to fail the whole basket on one such line; it now drops it and
 * prices the rest.
 *
 * That is better for the customer only if they are TOLD. The reduced total is
 * what Stripe charges, so nobody is overcharged, but they ticked the search
 * that vanished — and quietly supplying less than someone chose is the failure
 * these tests exist to prevent. Nothing may be persisted or charged until they
 * have seen the reduction and clicked again.
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
  searchOrderService: { createOrder: vi.fn(async () => ({ success: true })) },
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

/** The worker priced the basket but Groundsure declined the Cheshire brine line. */
function workerDroppedCheshireSalt() {
  vi.mocked(groundsureService.placeOrderForProperty).mockResolvedValue({
    success: true,
    id: 'row-1',
    ourReference: 'ref-1',
    retailGbp: 75.54,
    vatGbp: 12.59,
    dropped: [{ code: 'cheshire_salt', reason: 'needs_estimate' }],
    orderedCodes: ['hs'],
    status: 'pending_payment',
  });
}

describe('SearchesPanel — a line Groundsure would not price', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    markExplainerSeen('searches', 'tx-test-1');
    vi.mocked(postcodeService.getLocalAuthorityInfo).mockResolvedValue(laFixture());
    vi.mocked(stripePaymentService.prepareSearchCheckoutSession).mockResolvedValue({
      sessionId: 'cs_test',
      url: 'https://checkout.stripe.test/session',
    } as never);
  });

  it('should stop before payment and say so', async () => {
    workerDroppedCheshireSalt();
    renderPanel();

    await orderCheapestGroundsureBundle();

    expect(await screen.findByRole('alert')).toHaveTextContent(/can.t supply/i);
    expect(stripePaymentService.prepareSearchCheckoutSession).not.toHaveBeenCalled();
  });

  it('should quote the reduced total on the continue button, not the original', async () => {
    workerDroppedCheshireSalt();
    renderPanel();

    await orderCheapestGroundsureBundle();

    expect(await screen.findByRole('button', { name: /Continue with 1 search — £75\.54/ })).toBeInTheDocument();
  });

  // The whole point: nothing exists to be paid for until they have agreed to
  // the smaller basket.
  it('should persist no audit row while the customer is still deciding', async () => {
    workerDroppedCheshireSalt();
    renderPanel();

    await orderCheapestGroundsureBundle();
    await screen.findByRole('alert');

    expect(searchOrderService.createOrder).not.toHaveBeenCalled();
  });

  it('should leave no trace when the customer cancels', async () => {
    workerDroppedCheshireSalt();
    renderPanel();

    await orderCheapestGroundsureBundle();
    fireEvent.click(await screen.findByRole('button', { name: /^Cancel$/ }));

    await waitFor(() => {
      expect(screen.queryByText(/can.t supply/i)).not.toBeInTheDocument();
    });
    expect(searchOrderService.createOrder).not.toHaveBeenCalled();
    expect(stripePaymentService.prepareSearchCheckoutSession).not.toHaveBeenCalled();
  });

  it('should go to Stripe on the second, informed click', async () => {
    workerDroppedCheshireSalt();
    renderPanel();

    await orderCheapestGroundsureBundle();
    fireEvent.click(await screen.findByRole('button', { name: /^Continue with/ }));

    await waitFor(() => {
      expect(stripePaymentService.prepareSearchCheckoutSession).toHaveBeenCalled();
    });
  });

  // Re-pricing on the second click would ask Groundsure again and could return
  // a different basket than the one just consented to.
  it('should not re-price when continuing', async () => {
    workerDroppedCheshireSalt();
    renderPanel();

    await orderCheapestGroundsureBundle();
    fireEvent.click(await screen.findByRole('button', { name: /^Continue with/ }));

    await waitFor(() => {
      expect(stripePaymentService.prepareSearchCheckoutSession).toHaveBeenCalled();
    });
    expect(groundsureService.placeOrderForProperty).toHaveBeenCalledTimes(1);
  });

  it('should go straight to payment when nothing was dropped', async () => {
    vi.mocked(groundsureService.placeOrderForProperty).mockResolvedValue({
      success: true,
      id: 'row-1',
      ourReference: 'ref-1',
      retailGbp: 75.54,
      dropped: [],
      status: 'pending_payment',
    });
    renderPanel();

    await orderCheapestGroundsureBundle();

    await waitFor(() => {
      expect(stripePaymentService.prepareSearchCheckoutSession).toHaveBeenCalled();
    });
    expect(screen.queryByText(/can.t supply/i)).not.toBeInTheDocument();
  });

  // A worker deployment predating the drop behaviour omits the field entirely,
  // which is indistinguishable from "nothing was dropped".
  it('should go straight to payment when the worker sends no dropped field', async () => {
    vi.mocked(groundsureService.placeOrderForProperty).mockResolvedValue({
      success: true,
      id: 'row-1',
      ourReference: 'ref-1',
      retailGbp: 75.54,
      status: 'pending_payment',
    });
    renderPanel();

    await orderCheapestGroundsureBundle();

    await waitFor(() => {
      expect(stripePaymentService.prepareSearchCheckoutSession).toHaveBeenCalled();
    });
  });
});
