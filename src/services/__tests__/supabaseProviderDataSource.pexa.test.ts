import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseProviderDataSource, rowToProvider } from '../supabaseProviderDataSource';
import type { ConveyancerPanelRow } from '../supabaseProviderDataSource';
import { supabase } from '../../lib/supabase';

vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn() } }));
vi.mock('../postcodeService', () => ({
  postcodeService: { lookupPostcode: vi.fn().mockResolvedValue(null) },
  calculateDistanceMiles: vi.fn().mockReturnValue(1),
}));

function makeRow(overrides: Partial<ConveyancerPanelRow> = {}): ConveyancerPanelRow {
  return {
    id: 'a', practice_name: 'Alpha', clc_id: '1', postcode: 'AB1 2CD', city: 'Town',
    county: null, lat: null, lng: null, services: null, recommended: false,
    rating: 4, review_count: 1, active_on_panel: true, status: 'Active',
    ...overrides,
  };
}

describe('rowToProvider PEXA flag', () => {
  it('should mark a firm PEXA-enabled when pexa_enabled is true', () => {
    expect(rowToProvider(makeRow({ pexa_enabled: true })).isPexaEnabled).toBe(true);
  });

  it('should treat false, null and a missing column as not PEXA-enabled', () => {
    expect(rowToProvider(makeRow({ pexa_enabled: false })).isPexaEnabled).toBe(false);
    expect(rowToProvider(makeRow({ pexa_enabled: null })).isPexaEnabled).toBe(false);
    expect(rowToProvider(makeRow()).isPexaEnabled).toBe(false);
  });

  it('should never turn the PEXA flag into a highlight badge', () => {
    expect(rowToProvider(makeRow({ pexa_enabled: true })).highlight).toBeUndefined();
  });
});

describe('SupabaseProviderDataSource ordering ignores PEXA', () => {
  beforeEach(() => {
    const rows = [
      makeRow({ id: 'pexa', practice_name: 'Pexa Firm', rating: 3, pexa_enabled: true }),
      makeRow({ id: 'plain', practice_name: 'Plain Firm', rating: 5, pexa_enabled: false }),
    ];
    const chain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
        }),
      }),
    };
    vi.mocked(supabase.from).mockReturnValue(chain as never);
  });

  it('should not lift a PEXA-enabled firm above a better-rated firm', async () => {
    const result = await new SupabaseProviderDataSource().getProviders('conveyancer');
    expect(result.map((p) => p.id)).toEqual(['plain', 'pexa']);
  });
});
