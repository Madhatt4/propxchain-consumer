import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ConveyancerQuotesStage } from '../ConveyancerQuotesStage';
import { quoteTransactionTypeFor, sideOfQuoteType } from '../conveyancerQuoteSide';
import type { ComponentProps } from 'react';
import type { ConveyancerQuote } from '../../../../providers/types';

const panelProps = vi.fn();
vi.mock('../../../../providers/ConveyancerPanel', () => ({
  ConveyancerPanel: (p: { transactionType: string }) => {
    panelProps(p);
    return <div data-testid="panel">panel:{p.transactionType}</div>;
  },
}));
vi.mock('../../../../providers/QuoteComparisonView', () => ({
  QuoteComparisonView: ({ quotes }: { quotes: ConveyancerQuote[] }) => (
    <div data-testid="comparison">{quotes.map((q) => q.id).join(',')}</div>
  ),
}));
vi.mock('../../../../providers/PexaFact', () => ({ PexaFact: () => null }));
const mockGetQuotes = vi.fn();
vi.mock('../../../../../services/conveyancerQuote.service', () => ({
  conveyancerQuoteService: { getQuotesForTransaction: (...a: unknown[]) => mockGetQuotes(...a) },
}));
vi.mock('../../../../../services/buyerPack.service', () => ({ loadBuyerPack: vi.fn().mockResolvedValue([]) }));
vi.mock('../../../../../utils/rightmoveStorage', () => ({
  getRightmoveData: () => null,
  getTitleNumber: () => null,
  syncListingFromChain: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../../../../services/transactionFacts.service', () => ({
  seedTransactionFactsFromListing: vi.fn().mockResolvedValue(undefined),
  tenureLabel: () => undefined,
}));

type Props = ComponentProps<typeof ConveyancerQuotesStage>;

function renderStage(overrides: Partial<Props>): void {
  render(
    <ConveyancerQuotesStage
      stageSide="buyer"
      viewerSide="buyer"
      transactionId="tx_1"
      postcode="SG19 1AA"
      partyName="Test Buyer"
      partyEmail="buyer@example.com"
      propertyAddress="1 Test Street"
      onQuotesRequested={vi.fn()}
      {...overrides}
    />,
  );
}

function quote(id: string, transactionType: string): ConveyancerQuote {
  return { id, transactionType, status: 'quoted', conveyancerName: 'Firm' } as ConveyancerQuote;
}

describe('quoteTransactionTypeFor', () => {
  it('should map a buyer on the buyer stage to purchase', () => {
    expect(quoteTransactionTypeFor('buyer', 'buyer')).toEqual({ ok: true, transactionType: 'purchase' });
  });

  it('should map a seller on the seller stage to sale', () => {
    expect(quoteTransactionTypeFor('seller', 'seller')).toEqual({ ok: true, transactionType: 'sale' });
  });

  it('should refuse when the viewer side is other or not loaded', () => {
    expect(quoteTransactionTypeFor('seller', 'other')).toEqual({ ok: false, reason: 'side_unknown' });
    expect(quoteTransactionTypeFor('buyer', undefined)).toEqual({ ok: false, reason: 'side_unknown' });
  });

  it('should refuse a viewer browsing the other side stage', () => {
    expect(quoteTransactionTypeFor('seller', 'buyer')).toEqual({ ok: false, reason: 'other_side' });
    expect(quoteTransactionTypeFor('buyer', 'seller')).toEqual({ ok: false, reason: 'other_side' });
  });
});

describe('sideOfQuoteType', () => {
  it('should treat purchase as buyer and sale or new-build as seller, as the backend does', () => {
    expect(sideOfQuoteType('purchase')).toBe('buyer');
    expect(sideOfQuoteType('sale')).toBe('seller');
    expect(sideOfQuoteType('new-build')).toBe('seller');
  });
});

describe('ConveyancerQuotesStage side', () => {
  beforeEach(() => {
    panelProps.mockClear();
    mockGetQuotes.mockReset().mockResolvedValue([]);
  });

  it('should request estimates as purchase for the buyer', async () => {
    renderStage({ stageSide: 'buyer', viewerSide: 'buyer' });
    expect(await screen.findByTestId('panel')).toHaveTextContent('panel:purchase');
  });

  it('should request estimates as sale for the seller', async () => {
    renderStage({ stageSide: 'seller', viewerSide: 'seller' });
    expect(await screen.findByTestId('panel')).toHaveTextContent('panel:sale');
  });

  it('should not render the request panel and should say why when the side is unknown', async () => {
    renderStage({ stageSide: 'seller', viewerSide: 'other' });
    expect(await screen.findByRole('status')).toHaveTextContent(/couldn't confirm whether you're the buyer or the seller/);
    expect(panelProps).not.toHaveBeenCalled();
  });

  it('should not let a buyer request estimates from the seller stage', async () => {
    renderStage({ stageSide: 'seller', viewerSide: 'buyer' });
    expect(await screen.findByRole('status')).toHaveTextContent(/other side's conveyancer/);
    expect(panelProps).not.toHaveBeenCalled();
  });

  it('should show only the quotes for the stage side', async () => {
    mockGetQuotes.mockResolvedValue([quote('q-buy', 'purchase'), quote('q-sell', 'sale')]);
    renderStage({ stageSide: 'buyer', viewerSide: 'buyer' });
    await waitFor(() => expect(screen.getByTestId('comparison')).toHaveTextContent('q-buy'));
    expect(screen.getByTestId('comparison')).not.toHaveTextContent('q-sell');
  });
});
