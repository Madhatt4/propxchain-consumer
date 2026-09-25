import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConveyancerPanel } from '../ConveyancerPanel';
import { ProviderDataSourceProvider } from '../../../hooks/useProviderData';
import { searchCompatibilityService, SEARCH_COMPATIBILITY_REASONS } from '../../../services/searchCompatibility.service';
import type { Provider } from '../types';
import type { ProviderDataSource, ProviderDataSourceOptions } from '../../../services/providerDataSource';

vi.mock('../../../services/searchCompatibility.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/searchCompatibility.service')>();
  return {
    ...actual,
    searchCompatibilityService: {
      getDeclarations: vi.fn(),
      clearCache: vi.fn(),
    },
  };
});
vi.mock('../../../services/conveyancerQuote.service', () => ({
  conveyancerQuoteService: { requestQuotes: vi.fn().mockResolvedValue({ success: true }) },
}));
vi.mock('../../../hooks/useConveyancerSearch', () => ({
  useConveyancerSearch: () => ({ results: [], isLoading: false, error: null, hasQuery: false }),
}));

const NOW = new Date('2026-08-29T00:00:00.000Z');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const FIRMS: Provider[] = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'].map((id) => ({
  id, name: `Firm ${id}`, logo: 'FF', tagline: 'x', tier: 1 as const, price: 0,
  turnaround: 'Quote', rating: 4, reviews: 5,
  features: ['a', 'b', 'c', 'd'] as [string, string, string, string], regulated: `CLC #${id}`,
}));

class FakeSource implements ProviderDataSource {
  async getProviders(_c: string, _options?: ProviderDataSourceOptions): Promise<Provider[]> {
    return FIRMS.slice(0, 5);
  }
  async getProvider(): Promise<Provider | null> { return null; }
}

function renderPanel(props: Partial<Parameters<typeof ConveyancerPanel>[0]> = {}): void {
  render(
    <ProviderDataSourceProvider value={new FakeSource()}>
      <ConveyancerPanel
        postcode="" transactionId="tx-1" transactionType="sale"
        partyName="Test" partyEmail="t@t.com" propertyAddress="1 Test St"
        {...props}
      />
    </ProviderDataSourceProvider>,
  );
}

const mockDeclarations = vi.mocked(searchCompatibilityService.getDeclarations);

// f1-f3 accept (4 weeks old, no threshold); f4 reorders (requires own panel
// provider); f5 has no declaration at all -> unknown.
const issued4WeeksAgo = new Date(NOW.getTime() - 4 * WEEK_MS).toISOString();

// Built from the same constants the component renders from, so this
// assertion can never silently drift from the real badge copy.
const ANY_REASON_TEXT = new RegExp(
  Object.values(SEARCH_COMPATIBILITY_REASONS).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
);

describe('ConveyancerPanel search compatibility', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should show only accepting firms with green badges when matches >= 3', async () => {
    mockDeclarations.mockResolvedValue([
      { conveyancerId: 'f1', acceptsSellerOrderedSearches: true, requiresOwnPanelProvider: false, reorderThresholdWeeks: null },
      { conveyancerId: 'f2', acceptsSellerOrderedSearches: true, requiresOwnPanelProvider: false, reorderThresholdWeeks: null },
      { conveyancerId: 'f3', acceptsSellerOrderedSearches: true, requiresOwnPanelProvider: false, reorderThresholdWeeks: null },
      { conveyancerId: 'f4', acceptsSellerOrderedSearches: true, requiresOwnPanelProvider: true, reorderThresholdWeeks: null },
    ]);
    renderPanel({ originalSearchIssuedAt: issued4WeeksAgo });
    expect(await screen.findByText('Firm f1')).toBeInTheDocument();
    expect(screen.getAllByText(SEARCH_COMPATIBILITY_REASONS.accepts).length).toBe(3);
    // f4 (reorders) and f5 (unknown) are hidden by the default filter.
    expect(screen.queryByText('Firm f4')).not.toBeInTheDocument();
    expect(screen.queryByText('Firm f5')).not.toBeInTheDocument();
    expect(screen.getByText(/Showing the 3 firms that accept your existing searches/)).toBeInTheDocument();
  });

  it('should reveal reorders/unknown firms with neutral badges via Show all firms', async () => {
    mockDeclarations.mockResolvedValue([
      { conveyancerId: 'f1', acceptsSellerOrderedSearches: true, requiresOwnPanelProvider: false, reorderThresholdWeeks: null },
      { conveyancerId: 'f2', acceptsSellerOrderedSearches: true, requiresOwnPanelProvider: false, reorderThresholdWeeks: null },
      { conveyancerId: 'f3', acceptsSellerOrderedSearches: true, requiresOwnPanelProvider: false, reorderThresholdWeeks: null },
      { conveyancerId: 'f4', acceptsSellerOrderedSearches: false, requiresOwnPanelProvider: false, reorderThresholdWeeks: null },
    ]);
    renderPanel({ originalSearchIssuedAt: issued4WeeksAgo });
    await screen.findByText('Firm f1');
    fireEvent.click(screen.getByRole('button', { name: /show all firms/i }));
    expect(await screen.findByText('Firm f4')).toBeInTheDocument();
    expect(screen.getByText('Firm f5')).toBeInTheDocument();
    expect(screen.getByText(SEARCH_COMPATIBILITY_REASONS.reorders)).toBeInTheDocument();
    expect(screen.getByText(SEARCH_COMPATIBILITY_REASONS.unknown)).toBeInTheDocument();
  });

  it('should fall back to all firms with a neutral banner when accepting matches < 3', async () => {
    mockDeclarations.mockResolvedValue([
      { conveyancerId: 'f1', acceptsSellerOrderedSearches: true, requiresOwnPanelProvider: false, reorderThresholdWeeks: null },
    ]);
    renderPanel({ originalSearchIssuedAt: issued4WeeksAgo });
    expect(await screen.findByText(/Most firms haven't told us/)).toBeInTheDocument();
    expect(screen.getByText('Firm f5')).toBeInTheDocument();
  });

  it('should show no badges or filter when originalSearchIssuedAt is not passed', async () => {
    renderPanel();
    expect(await screen.findByText('Firm f1')).toBeInTheDocument();
    expect(mockDeclarations).not.toHaveBeenCalled();
    expect(screen.queryByText(ANY_REASON_TEXT)).not.toBeInTheDocument();
  });

  it('should show no badges or filter when originalSearchIssuedAt is null (no pack searches)', async () => {
    renderPanel({ originalSearchIssuedAt: null });
    expect(await screen.findByText('Firm f1')).toBeInTheDocument();
    expect(mockDeclarations).not.toHaveBeenCalled();
    expect(screen.queryByText(ANY_REASON_TEXT)).not.toBeInTheDocument();
  });

  it('should degrade to no badges (never a false accept) when the declarations lookup fails', async () => {
    mockDeclarations.mockRejectedValue(new Error('supabase down'));
    renderPanel({ originalSearchIssuedAt: issued4WeeksAgo });
    expect(await screen.findByText(/Most firms haven't told us/)).toBeInTheDocument();
    expect(screen.queryByText(SEARCH_COMPATIBILITY_REASONS.accepts)).not.toBeInTheDocument();
  });
});
