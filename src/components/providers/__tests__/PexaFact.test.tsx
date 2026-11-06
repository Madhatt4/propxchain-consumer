import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PexaFact, PEXA_FACT_TEXT } from '../PexaFact';
import { ProviderRow } from '../ProviderRow';
import { ProviderCard } from '../ProviderCard';
import { ComparePanel } from '../ComparePanel';
import { QuoteComparisonView } from '../QuoteComparisonView';
import type { ConveyancerQuote, Provider } from '../types';

vi.mock('../../../services/conveyancerQuote.service', () => ({
  conveyancerQuoteService: { acceptQuote: vi.fn() },
}));

function makeProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: 'p1', name: 'Test Firm', logo: 'TF', tagline: 'Bedford', tier: 1, price: 0,
    turnaround: 'Quote', rating: 4.5, reviews: 12,
    features: ['a', 'b', 'c', 'd'], regulated: 'CLC #123',
    ...overrides,
  };
}

function makeEstimate(overrides: Partial<ConveyancerQuote> = {}): ConveyancerQuote {
  return {
    id: 'q-1', transactionId: 'tx-1', conveyancerId: 'c-1', conveyancerName: 'Test Firm LLP',
    status: 'quoted', propertyAddress: '1 High St', transactionType: 'purchase',
    legalFee: 50000, createdAt: '2026-11-06T09:00:00Z',
    ...overrides,
  };
}

describe('PexaFact', () => {
  it('should read as a plain fact about completion', () => {
    expect(PEXA_FACT_TEXT).toBe('PEXA-enabled — completion can be same-day digital');
  });

  it('should render the fact when the firm is PEXA-enabled', () => {
    render(<PexaFact isPexaEnabled />);
    expect(screen.getByText(PEXA_FACT_TEXT)).toBeInTheDocument();
  });

  it('should render nothing at all when the firm is not PEXA-enabled', () => {
    const { container } = render(<PexaFact isPexaEnabled={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('PEXA fact on firm surfaces', () => {
  it('should show the fact in the panel row for a PEXA-enabled firm', () => {
    render(<ProviderRow provider={makeProvider({ isPexaEnabled: true })} selected={false} onSelect={vi.fn()} />);
    expect(screen.getByText(PEXA_FACT_TEXT)).toBeInTheDocument();
  });

  it('should show no PEXA text in the panel row for any other firm', () => {
    render(<ProviderRow provider={makeProvider()} selected={false} onSelect={vi.fn()} />);
    expect(screen.queryByText(/PEXA/)).not.toBeInTheDocument();
  });

  it('should show the fact on the provider card, not as a highlight badge', () => {
    render(<ProviderCard provider={makeProvider({ isPexaEnabled: true })} selected={false} onSelect={vi.fn()} />);
    const fact = screen.getByText(PEXA_FACT_TEXT);
    expect(fact.className).not.toMatch(/rounded-full|bg-/);
  });

  it('should show the fact only under the PEXA-enabled firm in a comparison', () => {
    render(
      <ComparePanel
        providerA={makeProvider({ id: 'a', name: 'Alpha', isPexaEnabled: true })}
        providerB={makeProvider({ id: 'b', name: 'Beta' })}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getAllByText(PEXA_FACT_TEXT)).toHaveLength(1);
  });

  it('should show the fact on the estimate card of a PEXA-enabled firm', () => {
    render(
      <QuoteComparisonView
        quotes={[
          makeEstimate({ id: 'q-1', conveyancerName: 'Alpha LLP', isConveyancerPexaEnabled: true }),
          makeEstimate({ id: 'q-2', conveyancerName: 'Beta LLP', isConveyancerPexaEnabled: false }),
        ]}
      />,
    );
    expect(screen.getAllByText(PEXA_FACT_TEXT)).toHaveLength(1);
  });

  it('should keep estimate cards in the order given, PEXA or not', () => {
    render(
      <QuoteComparisonView
        quotes={[
          makeEstimate({ id: 'q-1', conveyancerName: 'Alpha LLP' }),
          makeEstimate({ id: 'q-2', conveyancerName: 'Beta LLP', isConveyancerPexaEnabled: true }),
        ]}
      />,
    );
    const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(['Alpha LLP', 'Beta LLP']);
  });
});
