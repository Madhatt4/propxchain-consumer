import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lenderPanelService, decorateProviders, MIN_PANEL_MATCHES } from '../lenderPanel.service';
import { supabase } from '../../lib/supabase';
import type { Provider } from '../../components/providers/types';

vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn() } }));

function mockSelect(rows: unknown[], error: { message: string } | null = null): void {
  const chain = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: rows, error }),
      order: vi.fn().mockResolvedValue({ data: rows, error }),
    }),
  };
  vi.mocked(supabase.from).mockReturnValue(chain as never);
}

function makeProvider(id: string): Provider {
  return {
    id, name: `Firm ${id}`, logo: 'FF', tagline: 'x', tier: 1, price: 0,
    turnaround: 'Quote', rating: 4, reviews: 10,
    features: ['a', 'b', 'c', 'd'], regulated: 'CLC #1',
  };
}

describe('lenderPanelService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lenderPanelService.clearCache();
  });

  it('should return sorted lender names and cache the result', async () => {
    mockSelect([{ lender_name: 'Santander' }, { lender_name: 'Barclays Bank UK PLC' }]);
    const first = await lenderPanelService.getLenders();
    expect(first).toEqual(['Barclays Bank UK PLC', 'Santander']);
    await lenderPanelService.getLenders();
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('should return conveyancer ids for a lender and cache per lender', async () => {
    mockSelect([{ conveyancer_id: 'id-1' }, { conveyancer_id: 'id-2' }]);
    const ids = await lenderPanelService.getPanelConveyancerIds('Santander');
    expect(ids).toEqual(['id-1', 'id-2']);
    await lenderPanelService.getPanelConveyancerIds('Santander');
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('should throw a readable error when the query fails', async () => {
    mockSelect([], { message: 'boom' });
    await expect(lenderPanelService.getLenders()).rejects.toThrow(/boom/);
  });
});

describe('decorateProviders', () => {
  it('should mark panel members on and the rest off', () => {
    const out = decorateProviders([makeProvider('a'), makeProvider('b')], ['a'], 'Santander');
    expect(out[0].lenderPanelStatus).toBe('on');
    expect(out[1].lenderPanelStatus).toBe('off');
    expect(out[0].lenderPanelName).toBe('Santander');
  });

  it('should not mutate the input providers', () => {
    const input = [makeProvider('a')];
    decorateProviders(input, ['a'], 'Santander');
    expect(input[0].lenderPanelStatus).toBeUndefined();
  });
});

describe('MIN_PANEL_MATCHES', () => {
  it('should be 3 per the approved design', () => {
    expect(MIN_PANEL_MATCHES).toBe(3);
  });
});
