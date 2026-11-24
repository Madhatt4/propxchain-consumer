import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { SearchesPanel } from '../SearchesPanel';
import { postcodeService } from '../../../services/postcodeService';
import { groundsureService } from '../../../services/groundsure.service';
import { markExplainerSeen } from '../../explainer/explainerSeen';
import stripePaymentService from '@/services/stripePayment.service';
import type { LocalAuthorityInfo } from '../../../services/postcodeService';

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

async function orderCheapestGroundsureBundle(): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: /Groundsure bundles/i }));
  fireEvent.click(await screen.findByRole('button', { name: /^Homescreen/i }));
  fireEvent.click(await screen.findByRole('button', { name: /^Order 1 search/i }));
}

function workerPriced(retailGbp: number) {
  vi.mocked(groundsureService.placeOrderForProperty).mockResolvedValue({
    success: true,
    id: 'row-1',
    ourReference: 'ref-1',
    retailGbp,
    vatGbp: Math.round((retailGbp / 6) * 100) / 100,
    dropped: [],
    orderedCodes: ['hs'],
    status: 'pending_payment',
  });
}

describe('SearchesPanel - a price above the one shown', () => {
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

  it('should stop before payment and show the real price when it is higher', async () => {
    workerPriced(90);
    renderPanel();

    await orderCheapestGroundsureBundle();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The price for this property is £90.00');
    expect(alert).toHaveTextContent('not the £75.54 shown');
    expect(stripePaymentService.prepareSearchCheckoutSession).not.toHaveBeenCalled();
  });

  it('should go to payment at the real price on the second click', async () => {
    workerPriced(90);
    renderPanel();
    await orderCheapestGroundsureBundle();

    fireEvent.click(await screen.findByRole('button', { name: /Continue with 1 search — £90.00/ }));

    await waitFor(() => expect(stripePaymentService.prepareSearchCheckoutSession).toHaveBeenCalledTimes(1));
  });

  it('should charge nothing when the customer cancels', async () => {
    workerPriced(90);
    renderPanel();
    await orderCheapestGroundsureBundle();

    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(stripePaymentService.prepareSearchCheckoutSession).not.toHaveBeenCalled();
  });

  it('should go straight to payment when the price matches the one shown', async () => {
    workerPriced(75.54);
    renderPanel();

    await orderCheapestGroundsureBundle();

    await waitFor(() => expect(stripePaymentService.prepareSearchCheckoutSession).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
