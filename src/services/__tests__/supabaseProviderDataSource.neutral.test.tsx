import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SupabaseProviderDataSource, rowToProvider } from '../supabaseProviderDataSource';
import type { ConveyancerPanelRow } from '../supabaseProviderDataSource';
import { supabase } from '../../lib/supabase';
import { postcodeService } from '../postcodeService';
import type { PostcodeResult } from '../postcodeService';
import { ProviderCard } from '../../components/providers/ProviderCard';
import { ProviderRow } from '../../components/providers/ProviderRow';

// PropXchain is provider-neutral (Marc, 2026-11-07): the conveyancer_panel
// `recommended` column stays in the table but must never badge or reorder a firm.

vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn() } }));
vi.mock('../postcodeService', () => ({
  postcodeService: { lookupPostcode: vi.fn().mockResolvedValue(null) },
  calculateDistanceMiles: vi.fn((_lat: number, _lng: number, lat: number) => lat),
}));

function makeRow(overrides: Partial<ConveyancerPanelRow> = {}): ConveyancerPanelRow {
  return {
    id: 'a', practice_name: 'Alpha', clc_id: '1', postcode: 'AB1 2CD', city: 'Town',
    county: null, lat: null, lng: null, services: null, recommended: false,
    rating: 4, review_count: 1, active_on_panel: true, status: 'Active',
    ...overrides,
  };
}

function mockRows(rows: ConveyancerPanelRow[]): void {
  const chain = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
      }),
    }),
  };
  vi.mocked(supabase.from).mockReturnValue(chain as never);
}

describe('recommended flag is never shown to the client', () => {
  it('should not render a Recommended label on the card for a flagged firm', () => {
    const provider = rowToProvider(makeRow({ recommended: true }));
    render(<ProviderCard provider={provider} selected={false} onSelect={vi.fn()} />);
    expect(screen.queryByText(/recommended/i)).not.toBeInTheDocument();
  });

  it('should not render a Recommended label on the panel row for a flagged firm', () => {
    const provider = rowToProvider(makeRow({ recommended: true }));
    render(<ProviderRow provider={provider} selected={false} onSelect={vi.fn()} />);
    expect(screen.queryByText(/recommended/i)).not.toBeInTheDocument();
  });

  it('should map a flagged and an unflagged row to identical providers', () => {
    expect(rowToProvider(makeRow({ recommended: true }))).toEqual(
      rowToProvider(makeRow({ recommended: false })),
    );
  });
});

describe('recommended flag never changes the order', () => {
  beforeEach(() => {
    vi.mocked(postcodeService.lookupPostcode).mockResolvedValue(null);
  });

  it('should order by rating, not the flag, when no postcode is given', async () => {
    mockRows([
      makeRow({ id: 'flagged', rating: 3, recommended: true }),
      makeRow({ id: 'better', rating: 5, recommended: false }),
    ]);
    const result = await new SupabaseProviderDataSource().getProviders('conveyancer');
    expect(result.map((p) => p.id)).toEqual(['better', 'flagged']);
  });

  it('should order by rating, not the flag, when the postcode lookup fails', async () => {
    mockRows([
      makeRow({ id: 'flagged', rating: 3, recommended: true }),
      makeRow({ id: 'better', rating: 5, recommended: false }),
    ]);
    const result = await new SupabaseProviderDataSource().getProviders('conveyancer', {
      postcode: 'ZZ9 9ZZ',
    });
    expect(result.map((p) => p.id)).toEqual(['better', 'flagged']);
  });

  it('should order by distance, not the flag, when the postcode resolves', async () => {
    // The calculateDistanceMiles mock returns the row's lat as its distance.
    mockRows([
      makeRow({ id: 'flagged-far', lat: 20, lng: 0, recommended: true }),
      makeRow({ id: 'near', lat: 2, lng: 0, recommended: false }),
    ]);
    vi.mocked(postcodeService.lookupPostcode).mockResolvedValueOnce(
      { latitude: 51.5, longitude: -0.1 } as PostcodeResult,
    );
    const result = await new SupabaseProviderDataSource().getProviders('conveyancer', {
      postcode: 'AB1 2CD',
    });
    expect(result.map((p) => p.id)).toEqual(['near', 'flagged-far']);
  });
});
