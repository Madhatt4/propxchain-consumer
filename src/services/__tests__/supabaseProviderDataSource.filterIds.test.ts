import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseProviderDataSource } from '../supabaseProviderDataSource';
import { supabase } from '../../lib/supabase';
import { postcodeService } from '../postcodeService';
import type { PostcodeResult } from '../postcodeService';

vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn() } }));
vi.mock('../postcodeService', () => ({
  postcodeService: { lookupPostcode: vi.fn().mockResolvedValue(null) },
  calculateDistanceMiles: vi.fn().mockReturnValue(1),
}));

function makeRow(id: string, name: string, rating: number): Record<string, unknown> {
  return {
    id, practice_name: name, clc_id: '1', postcode: 'AB1 2CD', city: 'Town',
    county: null, lat: null, lng: null, services: null, recommended: false,
    rating, review_count: 1, active_on_panel: true, status: 'Active',
  };
}

describe('SupabaseProviderDataSource filterIds', () => {
  beforeEach(() => {
    const rows = [makeRow('a', 'Alpha', 5), makeRow('b', 'Beta', 4), makeRow('c', 'Gamma', 3)];
    const chain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
        }),
      }),
    };
    vi.mocked(supabase.from).mockReturnValue(chain as never);
  });

  it('should only return providers whose ids are in filterIds', async () => {
    const source = new SupabaseProviderDataSource();
    const result = await source.getProviders('conveyancer', { filterIds: ['b', 'c'] });
    expect(result.map((p) => p.id)).toEqual(['b', 'c']);
  });

  it('should return all providers when filterIds is undefined', async () => {
    const source = new SupabaseProviderDataSource();
    const result = await source.getProviders('conveyancer', {});
    expect(result).toHaveLength(3);
  });

  it('should return an empty list for an empty filterIds array', async () => {
    const source = new SupabaseProviderDataSource();
    const result = await source.getProviders('conveyancer', { filterIds: [] });
    expect(result).toHaveLength(0);
  });

  it('should apply filterIds before slicing on the postcode/distance-sort path', async () => {
    // Rows WITH coordinates so the distance branch attaches distances
    const geoRows = [
      { ...makeRow('a', 'Alpha', 5), lat: 51.5, lng: -0.1 },
      { ...makeRow('b', 'Beta', 4), lat: 51.6, lng: -0.2 },
      { ...makeRow('c', 'Gamma', 3), lat: 51.7, lng: -0.3 },
    ];
    const chain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: geoRows, error: null }),
        }),
      }),
    };
    vi.mocked(supabase.from).mockReturnValue(chain as never);
    // Successful postcode lookup — only latitude/longitude are read by getProviders
    vi.mocked(postcodeService.lookupPostcode).mockResolvedValueOnce(
      { latitude: 51.5, longitude: -0.1 } as PostcodeResult,
    );

    const source = new SupabaseProviderDataSource();
    const result = await source.getProviders('conveyancer', {
      postcode: 'AB1 2CD',
      filterIds: ['b', 'c'],
    });

    expect(result.map((p) => p.id)).toEqual(['b', 'c']);
    // Distances attached ⇒ proves the distance-sort branch ran, not the fallback
    expect(result.every((p) => p.distanceMiles !== undefined)).toBe(true);
  });
});
