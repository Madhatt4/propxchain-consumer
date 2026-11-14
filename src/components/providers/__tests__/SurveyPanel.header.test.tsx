import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SurveyPanel } from '../SurveyPanel';
import { ProviderDataSourceProvider } from '../../../hooks/useProviderData';
import type { Provider } from '../types';
import type { ProviderDataSource } from '../../../services/providerDataSource';

vi.mock('../../../services/surveyDocument.service', () => ({ uploadSurveyReport: vi.fn() }));
vi.mock('../../../services/scan.service', () => ({ fileToBase64: vi.fn(), runSurveyScan: vi.fn() }));
vi.mock('../../../services/buyerPack.service', () => ({ declareBuyerPack: vi.fn() }));

const SURVEYOR: Provider = {
  id: 'optimus', name: 'Optimus Surveys', logo: 'OP', tagline: 'x', tier: 1, price: 468,
  turnaround: '1 day', rating: 4, reviews: 5, features: ['a', 'b', 'c', 'd'], regulated: 'RICS',
};

class FakeSource implements ProviderDataSource {
  async getProviders(): Promise<Provider[]> { return [SURVEYOR]; }
  async getProvider(): Promise<Provider | null> { return null; }
}

describe('Survey stage header', () => {
  it('should not render the header block but keep the provider card and upload box', async () => {
    render(
      <ProviderDataSourceProvider value={new FakeSource()}>
        <SurveyPanel onSelect={vi.fn()} onContinue={vi.fn()} transactionId="tx-1" />
      </ProviderDataSourceProvider>,
    );
    expect(await screen.findByText('Optimus Surveys')).toBeInTheDocument();
    expect(screen.queryByText('Property Survey')).not.toBeInTheDocument();
    expect(screen.queryByText('Buyer Only')).not.toBeInTheDocument();
    expect(screen.queryByText(/Commission an independent/)).not.toBeInTheDocument();
    expect(screen.queryByText(/independent assessment of the property/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Same price as going direct/)).not.toBeInTheDocument();
    expect(screen.getByText(/Already had a survey done/)).toBeInTheDocument();
    expect(screen.getByText(/Upload survey report/)).toBeInTheDocument();
  });
});
