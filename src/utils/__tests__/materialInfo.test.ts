// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { buildMaterialInfo, emptyMaterialInfo, normalizeMaterialInfo } from '../materialInfo';
import { listingWithMaterialInfo } from '../materialInfo';
import type { PropertyListing } from '@/types/listing.types';
import type { EpcCertificate } from '@/services/epc.service';

const listing = {
  price: 325000, tenure: 'leasehold', councilTaxBand: 'C', epcRating: 'D',
  leaseYearsRemaining: 99, groundRentPerYear: 250, serviceChargePerYear: 1200,
} as unknown as PropertyListing;

describe('buildMaterialInfo', () => {
  it('takes price, tenure, council tax and lease facts from the listing', () => {
    const mi = buildMaterialInfo(listing, null, {});
    expect(mi.price).toEqual({ value: 325000, source: 'listing' });
    expect(mi.tenure).toEqual({ value: 'leasehold', source: 'listing' });
    expect(mi.councilTaxBand).toEqual({ value: 'C', source: 'listing' });
    expect(mi.leaseYearsRemaining).toEqual({ value: 99, source: 'listing' });
  });
  it('prefers the EPC certificate over the listing for rating and adds floor area', () => {
    const epc = { currentBand: 'C', floorAreaSqm: 84 } as unknown as EpcCertificate;
    const mi = buildMaterialInfo(listing, epc, {});
    expect(mi.epcRating).toEqual({ value: 'C', source: 'epc' });
    expect(mi.epcFloorAreaSqm).toEqual({ value: 84, source: 'epc' });
  });
  it('agent overrides win over everything', () => {
    const mi = buildMaterialInfo(listing, null, { councilTaxBand: 'D', floodRisk: 'Very low' });
    expect(mi.councilTaxBand).toEqual({ value: 'D', source: 'agent' });
    expect(mi.floodRisk).toEqual({ value: 'Very low', source: 'agent' });
  });
  it('marks unknowns as missing and never fabricates', () => {
    const mi = buildMaterialInfo({ price: 0, tenure: 'unknown', councilTaxBand: null, epcRating: null } as unknown as PropertyListing, null, {});
    expect(mi.price).toEqual({ value: null, source: 'missing' });
    expect(mi.tenure).toEqual({ value: null, source: 'missing' });
    expect(mi.conservationArea).toEqual({ value: null, source: 'missing' });
    expect(emptyMaterialInfo().listedBuilding).toEqual({ value: null, source: 'missing' });
  });
});

describe('normalizeMaterialInfo', () => {
  it('fills every field as missing for the DB default of {}', () => {
    expect(normalizeMaterialInfo({})).toEqual(emptyMaterialInfo());
  });
  it('keeps provided fields and fills only the gaps', () => {
    const result = normalizeMaterialInfo({ price: { value: 325000, source: 'listing' } });
    expect(result.price).toEqual({ value: 325000, source: 'listing' });
    expect(result.tenure).toEqual({ value: null, source: 'missing' });
  });
});


describe('listingWithMaterialInfo', () => {
  const base = {
    address: '1 Test Street', postcode: 'SG19 1AB', price: 250000, propertyType: 'Flat', tenure: 'unknown',
    councilTaxBand: null, epcRating: null, provenance: {},
  } as unknown as import('@/types/listing.types').PropertyListing;

  it('should fill blanks from material info and tag each by its source', () => {
    const info = {
      tenure: { value: 'leasehold', source: 'listing' },
      councilTaxBand: { value: 'C', source: 'agent' },
      epcRating: { value: 'B', source: 'epc' },
      leaseYearsRemaining: { value: 99, source: 'agent' },
      groundRentPerYear: { value: 100, source: 'agent' },
      serviceChargePerYear: { value: null, source: 'missing' },
    } as unknown as import('@/types/materialInfo.types').MaterialInfo;
    const out = listingWithMaterialInfo(base, info);
    expect(out).toMatchObject({ tenure: 'leasehold', councilTaxBand: 'C', epcRating: 'B', leaseYearsRemaining: 99, groundRentPerYear: 100 });
    expect(out.serviceChargePerYear).toBeUndefined();
    expect(out.provenance).toMatchObject({ councilTaxBand: 'agent', epcRating: 'epc-register', tenure: 'adapter' });
  });

  it('should never overwrite a value the listing already holds, and return the same object when nothing changes', () => {
    const held = { ...base, tenure: 'freehold', councilTaxBand: 'A', epcRating: 'D' } as typeof base;
    const info = {
      tenure: { value: 'leasehold', source: 'agent' },
      councilTaxBand: { value: 'C', source: 'agent' },
      epcRating: { value: 'B', source: 'epc' },
    } as unknown as import('@/types/materialInfo.types').MaterialInfo;
    expect(listingWithMaterialInfo(held, info)).toBe(held);
    expect(listingWithMaterialInfo(held, null)).toBe(held);
  });
});
