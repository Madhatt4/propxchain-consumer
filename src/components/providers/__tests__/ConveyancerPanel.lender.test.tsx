import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConveyancerPanel } from '../ConveyancerPanel';
import { ProviderDataSourceProvider } from '../../../hooks/useProviderData';
import { lenderPanelService } from '../../../services/lenderPanel.service';
import type { Provider } from '../types';
import type { ProviderDataSource, ProviderDataSourceOptions } from '../../../services/providerDataSource';

vi.mock('../../../services/lenderPanel.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/lenderPanel.service')>();
  return {
    ...actual,
    lenderPanelService: {
      getLenders: vi.fn().mockResolvedValue(['Santander']),
      getPanelConveyancerIds: vi.fn(),
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

const FIRMS: Provider[] = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'].map((id) => ({
  id, name: `Firm ${id}`, logo: 'FF', tagline: 'x', tier: 1 as const, price: 0,
  turnaround: 'Quote', rating: 4, reviews: 5,
  features: ['a', 'b', 'c', 'd'] as [string, string, string, string], regulated: `CLC #${id}`,
}));

// Production-faithful: mirrors SupabaseProviderDataSource, which applies
// filterIds THEN caps the result to the top 5 nearest rows. With 6 firms
// and no filter this means f6 never renders — the count shown to the user
// can legitimately be fewer than the panel total.
class FakeSource implements ProviderDataSource {
  async getProviders(_c: string, options?: ProviderDataSourceOptions): Promise<Provider[]> {
    let rows = FIRMS;
    if (options?.filterIds) {
      const allow = new Set(options.filterIds);
      rows = rows.filter((p) => allow.has(p.id));
    }
    return rows.slice(0, 5);
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

const mockIds = vi.mocked(lenderPanelService.getPanelConveyancerIds);

describe('ConveyancerPanel lender filtering', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should show only panel firms with green badges when lender has >= 3 matches', async () => {
    mockIds.mockResolvedValue(['f1', 'f2', 'f3']);
    renderPanel({ lenderName: 'Santander' });
    // 3 matched firms, well under the 5-row cap, so all 3 render.
    expect(await screen.findByText("Showing the 3 nearest firms on Santander's panel (3 on panel)")).toBeInTheDocument();
    // Await a positive row anchor before the negative/count assertions —
    // the provider fetch settles after the filter bar renders.
    expect(await screen.findByText('Firm f1')).toBeInTheDocument();
    expect(screen.queryByText('Firm f4')).not.toBeInTheDocument();
    expect(screen.getAllByText("On Santander's panel ✓").length).toBe(3);
  });

  it('should reveal non-panel firms with amber badges via Show all firms', async () => {
    mockIds.mockResolvedValue(['f1', 'f2', 'f3']);
    renderPanel({ lenderName: 'Santander' });
    fireEvent.click(await screen.findByRole('button', { name: /show all firms/i }));
    expect(await screen.findByText('Firm f4')).toBeInTheDocument();
    expect(screen.getAllByText("Not on Santander's panel").length).toBeGreaterThan(0);
  });

  it('should fall back to all firms with a banner when matches < 3', async () => {
    mockIds.mockResolvedValue(['f1']);
    renderPanel({ lenderName: 'Santander' });
    expect(await screen.findByText(/We don't hold panel data for Santander/)).toBeInTheDocument();
    // Row assertion is async-safe: the banner renders as soon as the lookup
    // settles, one commit before the (unfiltered) provider fetch completes.
    // Unfiltered fallback is still capped at the top-5 nearest — f6 never
    // renders, so f5 (the last of the 5) is the truthful anchor.
    expect(await screen.findByText('Firm f5')).toBeInTheDocument();
  });

  it('should show the fallback banner without any panel badges when the lookup fails', async () => {
    mockIds.mockRejectedValue(new Error('supabase down'));
    renderPanel({ lenderName: 'Santander' });
    expect(await screen.findByText(/We don't hold panel data for Santander/)).toBeInTheDocument();
    expect(await screen.findByText('Firm f1')).toBeInTheDocument();
    // No data held → no badges at all; a false amber "Not on …" under a
    // "we hold no data" banner would contradict the banner.
    expect(screen.queryByText(/On Santander's panel/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Not on Santander's panel/)).not.toBeInTheDocument();
    // Unfiltered degradation is still capped at the top-5 nearest — f6 is
    // never fetched, so only the 5 that render are asserted present.
    for (const id of ['f1', 'f2', 'f3', 'f4', 'f5']) {
      expect(screen.getByText(`Firm ${id}`)).toBeInTheDocument();
    }
    expect(screen.queryByText('Firm f6')).not.toBeInTheDocument();
  });

  it('should show the lender prompt when no lender is set and capture the answer', async () => {
    mockIds.mockResolvedValue(['f1', 'f2', 'f3']);
    const onCaptured = vi.fn();
    renderPanel({ onLenderCaptured: onCaptured });
    const select = await screen.findByLabelText('Your mortgage lender');
    // The select renders before getLenders() resolves; changing to a lender
    // before its <option> exists is a no-op in jsdom, so wait for the option.
    await screen.findByRole('option', { name: 'Santander' });
    fireEvent.change(select, { target: { value: 'Santander' } });
    expect(onCaptured).toHaveBeenCalledWith('Santander');
    expect(await screen.findByText("Showing the 3 nearest firms on Santander's panel (3 on panel)")).toBeInTheDocument();
  });

  it('should behave exactly as today when neither lenderName nor onLenderCaptured is passed (seller/builder)', async () => {
    renderPanel();
    expect(await screen.findByText('Firm f1')).toBeInTheDocument();
    // Unfiltered list is still capped at the top-5 nearest — f6 never renders.
    expect(screen.getByText('Firm f5')).toBeInTheDocument();
    expect(screen.queryByText('Firm f6')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Your mortgage lender')).not.toBeInTheDocument();
    expect(screen.queryByText(/panel ✓/)).not.toBeInTheDocument();
  });
});
