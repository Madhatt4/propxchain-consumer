// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { supabase } from '../lib/supabase';
import { postcodeService, calculateDistanceMiles } from './postcodeService';
import type { Provider } from '../components/providers/types';
import type { ProviderDataSource, ProviderDataSourceOptions } from './providerDataSource';

// Shape of a row from the conveyancer_panel table
export interface ConveyancerPanelRow {
  id: string;
  practice_name: string;
  clc_id: string;
  postcode: string | null;
  city: string | null;
  county: string | null;
  lat: number | null;
  lng: number | null;
  services: string | null;
  recommended: boolean | null;
  rating: number | null;
  review_count: number | null;
  active_on_panel: boolean;
  status: string;
}

function deriveFeatures(services: string | null): [string, string, string, string] {
  const raw = services?.toLowerCase() ?? '';
  const hasProbate = raw.includes('probate');
  const hasWills = raw.includes('will writing');
  const hasLpa = raw.includes('lasting powers');
  return [
    'CLC Licensed',
    hasProbate ? 'Probate Services' : 'Conveyancing Specialist',
    hasWills ? 'Will Writing' : 'Residential Property',
    hasLpa ? 'Lasting Powers of Attorney' : 'Commissioner of Oaths',
  ];
}

export function rowToProvider(row: ConveyancerPanelRow, distanceMiles?: number): Provider {
  const logoChars = (row.practice_name ?? '??').slice(0, 2).toUpperCase();
  const locationParts = [row.city, row.county].filter(Boolean);
  return {
    id: row.id,
    name: row.practice_name,
    logo: logoChars,
    tagline: locationParts.length > 0 ? locationParts.join(', ') : 'UK Conveyancer',
    tier: 1,
    price: 0,
    turnaround: 'Quote',
    rating: row.rating ?? 0,
    reviews: row.review_count ?? 0,
    features: deriveFeatures(row.services),
    regulated: `CLC #${row.clc_id}`,
    location: locationParts.join(', ') || undefined,
    postcode: row.postcode ?? undefined,
    distanceMiles: (distanceMiles !== undefined && !isNaN(distanceMiles)) ? Math.round(distanceMiles * 10) / 10 : undefined,
    highlight: row.recommended ? 'Recommended' : undefined,
  };
}

export class SupabaseProviderDataSource implements ProviderDataSource {
  async getProviders(
    _category: string,
    options?: ProviderDataSourceOptions,
  ): Promise<Provider[]> {
    const { data, error } = await supabase
      .from('conveyancer_panel')
      .select('*')
      .eq('active_on_panel', true)
      .eq('status', 'Active');

    if (error) {
      throw new Error(`Failed to load conveyancers: ${error.message}`);
    }

    let rows: ConveyancerPanelRow[] = data ?? [];
    if (options?.filterIds) {
      const allow = new Set(options.filterIds);
      rows = rows.filter((r) => allow.has(r.id));
    }

    // No postcode or empty — return recommended first, then by rating, top 5
    if (!options?.postcode?.trim()) {
      const sorted = [...rows].sort((a, b) => {
        if ((b.recommended ? 1 : 0) !== (a.recommended ? 1 : 0)) {
          return (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0);
        }
        return (b.rating ?? 0) - (a.rating ?? 0);
      });
      return sorted.slice(0, 5).map((r) => rowToProvider(r));
    }

    // Postcode provided — lookup lat/lng and sort by distance
    const geo = await postcodeService.lookupPostcode(options.postcode);

    if (!geo || geo.latitude === null || geo.longitude === null) {
      // Postcode lookup failed — fall back to recommended/rating sort
      const sorted = [...rows].sort((a, b) => {
        if ((b.recommended ? 1 : 0) !== (a.recommended ? 1 : 0)) {
          return (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0);
        }
        return (b.rating ?? 0) - (a.rating ?? 0);
      });
      return sorted.slice(0, 5).map((r) => rowToProvider(r));
    }

    const userLat = geo.latitude;
    const userLng = geo.longitude;

    // Attach distance to each row that has coordinates
    const withDistance = rows.map((row) => ({
      row,
      distance:
        row.lat !== null && row.lng !== null
          ? calculateDistanceMiles(userLat, userLng, row.lat, row.lng)
          : undefined,
    }));

    // Sort: recommended first, then by distance (nulls last), then by rating
    withDistance.sort((a, b) => {
      const aRec = a.row.recommended ? 1 : 0;
      const bRec = b.row.recommended ? 1 : 0;
      if (bRec !== aRec) return bRec - aRec;
      if (a.distance !== undefined && b.distance !== undefined) return a.distance - b.distance;
      if (a.distance !== undefined) return -1;
      if (b.distance !== undefined) return 1;
      return (b.row.rating ?? 0) - (a.row.rating ?? 0);
    });

    return withDistance.slice(0, 5).map(({ row, distance }) => rowToProvider(row, distance));
  }

  async getProvider(id: string): Promise<Provider | null> {
    const { data, error } = await supabase
      .from('conveyancer_panel')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return rowToProvider(data as ConveyancerPanelRow);
  }
}
