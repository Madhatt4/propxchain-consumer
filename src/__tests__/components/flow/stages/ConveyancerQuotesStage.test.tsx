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
});
