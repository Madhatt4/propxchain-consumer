// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PropertyListing } from '@/types/listing.types';

const mockGetUser = vi.fn();
const mockMaybeSingle = vi.fn();
const mockUpsert = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: () => mockGetUser() },
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => mockMaybeSingle() }) }) }),
      upsert: (...a: unknown[]) => mockUpsert(...a),
    }),
  },
}));

import { factsFromListing, seedTransactionFactsFromListing, tenureLabel } from '../transactionFacts.service';

function listing(overrides: Partial<PropertyListing> = {}): PropertyListing {
  return {
    address: '12 High Street',
    postcode: 'SG19 1AB',
    price: 1,
    tenure: 'leasehold',
    propertyType: 'Penthouse',
    provenance: {},
    ...overrides,
  } as PropertyListing;
}

beforeEach(() => {
  mockGetUser.mockReset().mockResolvedValue({ data: { user: { id: 'u-1' } } });
  mockMaybeSingle.mockReset().mockResolvedValue({ data: null });
  mockUpsert.mockReset().mockResolvedValue({ error: null });
});

describe('factsFromListing', () => {
  it('should map flat-like types and leasehold to the table vocabulary', () => {
    expect(factsFromListing(listing())).toEqual({ property_type: 'flat', declared_tenure: 'Leasehold' });
    expect(factsFromListing(listing({ propertyType: 'Detached', tenure: 'freehold' }))).toEqual({ property_type: 'house', declared_tenure: 'Freehold' });
  });

  it('should treat share of freehold as leasehold and unknowns as null', () => {
    expect(factsFromListing(listing({ tenure: 'shareOfFreehold' })).declared_tenure).toBe('Leasehold');
    expect(factsFromListing(listing({ tenure: 'unknown', propertyType: '' }))).toEqual({ property_type: null, declared_tenure: null });
    expect(factsFromListing(null)).toEqual({ property_type: null, declared_tenure: null });
  });
});

describe('tenureLabel', () => {
  it('should give the quote email a readable tenure, or nothing when unknown', () => {
    expect(tenureLabel(listing())).toBe('Leasehold');
    expect(tenureLabel(listing({ tenure: 'shareOfFreehold' }))).toBe('Share of freehold');
    expect(tenureLabel(listing({ tenure: 'unknown' }))).toBeUndefined();
  });
});

describe('seedTransactionFactsFromListing', () => {
  it('should upsert the caller row with both facts when none are held', async () => {
    const written = await seedTransactionFactsFromListing('tx-1', listing());
    expect(written).toEqual({ property_type: 'flat', declared_tenure: 'Leasehold' });
    expect(mockUpsert).toHaveBeenCalledWith(
      { transaction_id: 'tx-1', user_id: 'u-1', property_type: 'flat', declared_tenure: 'Leasehold' },
      { onConflict: 'transaction_id,user_id' },
    );
  });

  it('should never overwrite a fact the party already answered', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { property_type: 'house', declared_tenure: null } });
    const written = await seedTransactionFactsFromListing('tx-1', listing());
    expect(written).toEqual({ declared_tenure: 'Leasehold' });
    expect(mockUpsert.mock.calls[0][0]).not.toHaveProperty('property_type');
  });

  it('should write nothing when the listing has nothing to say or there is no user', async () => {
    expect(await seedTransactionFactsFromListing('tx-1', listing({ tenure: 'unknown', propertyType: '' }))).toEqual({});
    mockGetUser.mockResolvedValue({ data: { user: null } });
    expect(await seedTransactionFactsFromListing('tx-1', listing())).toEqual({});
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('should report nothing written when the upsert fails', async () => {
    mockUpsert.mockResolvedValue({ error: { message: 'rls' } });
    expect(await seedTransactionFactsFromListing('tx-1', listing())).toEqual({});
  });
});
