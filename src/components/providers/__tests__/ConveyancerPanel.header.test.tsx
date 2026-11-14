import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConveyancerPanel } from '../ConveyancerPanel';
import { ProviderPanel } from '../ProviderPanel';
import { ProviderDataSourceProvider } from '../../../hooks/useProviderData';
import type { Provider } from '../types';
import type { ProviderDataSource } from '../../../services/providerDataSource';

vi.mock('../../../services/conveyancerQuote.service', () => ({
  conveyancerQuoteService: { requestQuotes: vi.fn().mockResolvedValue({ success: true }) },
}));
vi.mock('../../../hooks/useConveyancerSearch', () => ({
  useConveyancerSearch: () => ({ results: [], isLoading: false, error: null, hasQuery: false }),
}));

const FIRM: Provider = {
  id: 'f1', name: 'Firm One', logo: 'F1', tagline: 'x', tier: 1, price: 0,
  turnaround: 'Estimate', rating: 4, reviews: 5,
  features: ['a', 'b', 'c', 'd'], regulated: 'CLC #1',
};

class FakeSource implements ProviderDataSource {
  async getProviders(): Promise<Provider[]> { return [FIRM]; }
  async getProvider(): Promise<Provider | null> { return null; }
}

const panelProps = {
  title: 'Property Survey',
  subtitle: 'Commission an independent survey',
  stageNumber: 4,
  badge: 'RICS',
  description: 'Pick a surveyor.',
  providers: [FIRM],
  onSelect: vi.fn(),
  onContinue: vi.fn(),
};

describe('Conveyancer stage header', () => {
  it('should not render the panel header block or price line', async () => {
    render(
      <ProviderDataSourceProvider value={new FakeSource()}>
        <ConveyancerPanel
          postcode="" transactionId="tx-1" transactionType="sale"
          partyName="Test" partyEmail="t@t.com" propertyAddress="1 Test St"
        />
      </ProviderDataSourceProvider>,
    );
    expect(await screen.findByText('Firm One')).toBeInTheDocument();
    expect(screen.queryByText('Conveyancer / Solicitor')).not.toBeInTheDocument();
    expect(screen.queryByText('Local Panel')).not.toBeInTheDocument();
    expect(screen.queryByText(/Pick your own conveyancer/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Same price as going direct/)).not.toBeInTheDocument();
  });

  it('should say estimate, never quote, in the visible copy', async () => {
    const { container } = render(
      <ProviderDataSourceProvider value={new FakeSource()}>
        <ConveyancerPanel
          postcode="" transactionId="tx-1" transactionType="sale"
          partyName="Test" partyEmail="t@t.com" propertyAddress="1 Test St"
        />
      </ProviderDataSourceProvider>,
    );
    expect(await screen.findByText('Firm One')).toBeInTheDocument();
    expect(screen.getByText(/request estimates from/)).toBeInTheDocument();
    expect(screen.getByText(/No commitment/)).toBeInTheDocument();
    expect(screen.getByText('Estimate on request')).toBeInTheDocument();
    expect(container.textContent ?? '').not.toMatch(/quote/i);
  });

  it('should keep the header on other provider stages by default', () => {
    render(<ProviderPanel {...panelProps} />);
    expect(screen.getByText('Property Survey')).toBeInTheDocument();
    expect(screen.getByText('RICS')).toBeInTheDocument();
    expect(screen.getByText(/Same price as going direct/)).toBeInTheDocument();
  });

  it('should hide the header when hideHeader is set', () => {
    render(<ProviderPanel {...panelProps} hideHeader />);
    expect(screen.queryByText('Property Survey')).not.toBeInTheDocument();
    expect(screen.queryByText(/Same price as going direct/)).not.toBeInTheDocument();
    expect(screen.getByText('Firm One')).toBeInTheDocument();
  });
});
