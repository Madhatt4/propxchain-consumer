import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ConveyancerQuotesStage } from '../../../../components/transaction/flow/stages/ConveyancerQuotesStage';
import { conveyancerQuoteService } from '../../../../services/conveyancerQuote.service';
import type { ConveyancerQuote } from '../../../../components/providers/types';

vi.mock('../../../../services/conveyancerQuote.service', () => ({
  conveyancerQuoteService: {
    getQuotesForTransaction: vi.fn(),
  },
}));

vi.mock('../../../../components/providers/ConveyancerPanel', () => ({
  ConveyancerPanel: () => <div data-testid="conveyancer-panel" />,
}));

vi.mock('../../../../components/providers/QuoteComparisonView', () => ({
  QuoteComparisonView: () => <div data-testid="quote-comparison" />,
}));

function makeQuote(overrides: Partial<ConveyancerQuote>): ConveyancerQuote {
  return {
    id: 'q-1',
    transactionId: 'tx-1',
    conveyancerId: 'c-1',
    conveyancerName: 'Smith Conveyancing',
    status: 'quoted',
    propertyAddress: '1 Test Street',
    transactionType: 'sale',
    createdAt: '2026-07-01T00:00:00Z',
    ...overrides,
  } as ConveyancerQuote;
}

const baseProps = {
  stageSide: 'seller' as const,
  viewerSide: 'seller' as const,
  transactionId: 'tx-1',
  postcode: 'MK40 1AA',
  partyName: 'Seller One',
  partyEmail: 'seller@example.com',
  propertyAddress: '1 Test Street',
  onQuotesRequested: vi.fn(),
};

describe('ConveyancerQuotesStage', () => {
  beforeEach(() => {
    vi.mocked(conveyancerQuoteService.getQuotesForTransaction).mockReset();
  });

  it('should render the provider panel when no quotes exist yet', async () => {
    vi.mocked(conveyancerQuoteService.getQuotesForTransaction).mockResolvedValue([]);

    render(<ConveyancerQuotesStage {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('conveyancer-panel')).toBeInTheDocument();
    });
  });

  it('should render the quote comparison once quotes exist', async () => {
    vi.mocked(conveyancerQuoteService.getQuotesForTransaction).mockResolvedValue([
      makeQuote({ status: 'quoted' }),
    ]);

    render(<ConveyancerQuotesStage {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('quote-comparison')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /request more quotes/i })).toBeInTheDocument();
  });

  it('should show the instructed banner when a quote is accepted', async () => {
    vi.mocked(conveyancerQuoteService.getQuotesForTransaction).mockResolvedValue([
      makeQuote({ id: 'q-1', status: 'accepted' }),
      makeQuote({ id: 'q-2', status: 'declined' }),
    ]);

    render(<ConveyancerQuotesStage {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Smith Conveyancing instructed/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/activation link/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /request more quotes/i })).not.toBeInTheDocument();
  });

  describe('once the firm for the side has joined', () => {
    const joined = { principal: 'rrkah-fqaaa-aaaaa-aaaaq-cai', firmName: 'Laburnum Law LLP' };

    it('should say the firm is on the transaction instead of waiting for it to join', async () => {
      vi.mocked(conveyancerQuoteService.getQuotesForTransaction).mockResolvedValue([
        makeQuote({ id: 'q-1', status: 'accepted', conveyancerName: 'Laburnum Law' }),
      ]);

      render(<ConveyancerQuotesStage {...baseProps} joinedConveyancer={joined} />);

      expect(await screen.findByTestId('conveyancer-joined')).toHaveTextContent(
        'Laburnum Law LLP is on this transaction as your conveyancer.',
      );
      expect(screen.queryByText(/once they join/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/instructed$/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /request more/i })).not.toBeInTheDocument();
    });

    it('should name the side for a viewer on the other side', async () => {
      vi.mocked(conveyancerQuoteService.getQuotesForTransaction).mockResolvedValue([]);

      render(<ConveyancerQuotesStage {...baseProps} stageSide="buyer" viewerSide="seller" joinedConveyancer={joined} />);

      expect(await screen.findByTestId('conveyancer-joined')).toHaveTextContent(
        "Laburnum Law LLP is on this transaction as the buyer's conveyancer.",
      );
    });

    it('should show the joined firm, not the panel, when there were no estimates on PropXchain', async () => {
      vi.mocked(conveyancerQuoteService.getQuotesForTransaction).mockResolvedValue([]);

      render(<ConveyancerQuotesStage {...baseProps} joinedConveyancer={joined} />);

      expect(await screen.findByTestId('conveyancer-joined')).toBeInTheDocument();
      expect(screen.queryByTestId('conveyancer-panel')).not.toBeInTheDocument();
      expect(screen.queryByTestId('quote-comparison')).not.toBeInTheDocument();
    });

    it('should fall back to the accepted firm name when the slot has none', async () => {
      vi.mocked(conveyancerQuoteService.getQuotesForTransaction).mockResolvedValue([
        makeQuote({ id: 'q-1', status: 'accepted', conveyancerName: 'Laburnum Law' }),
      ]);

      render(<ConveyancerQuotesStage {...baseProps} joinedConveyancer={{ ...joined, firmName: null }} />);

      expect(await screen.findByTestId('conveyancer-joined')).toHaveTextContent(
        'Laburnum Law is on this transaction as your conveyancer.',
      );
    });
  });
});
