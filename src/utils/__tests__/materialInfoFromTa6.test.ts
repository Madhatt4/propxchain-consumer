// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { partBFromTa6 } from '../materialInfoFromTa6';
import { buildMaterialInfo } from '../materialInfo';
import { emptyTA6Form } from '@/types/ta6.defaults';
import type { PropertyListing } from '@/types/listing.types';

function answeredTa6() {
  const ta6 = emptyTA6Form();
  ta6.section10.q10_1Arrangements = ['driveway', 'garage'];
  ta6.section11.q11_4HeatingSystems = [
    { heatingType: 'gas-central', otherDetails: null, installDate: null, lastServiceDate: null, certificate: ta6.section11.q11_2Document },
  ];
  ta6.section11.q11_6SewerageSource = 'septic-tank';
  ta6.section12.mainsElectricity = { ...ta6.section12.mainsElectricity, connected: 'yes', provider: 'Octopus', supplyNumber: '1234' };
  ta6.section12.mainsWater = { ...ta6.section12.mainsWater, connected: 'no' };
  ta6.section12.broadband = { connected: 'yes', provider: 'BT' };
  return ta6;
}

describe('partBFromTa6', () => {
  it('reads Part B from TA6 sections 10 to 12', () => {
    expect(partBFromTa6(answeredTa6())).toEqual({
      electricity: 'Mains',
      water: 'Private supply',
      sewerage: 'Septic tank',
      heating: 'Gas central heating',
      broadband: 'Connected',
      parking: 'Driveway, Garage',
    });
  });
  it('never copies provider names or meter numbers', () => {
    const json = JSON.stringify(partBFromTa6(answeredTa6()));
    expect(json).not.toMatch(/Octopus|BT|1234/);
  });
  it('leaves unanswered and not-known questions blank', () => {
    const ta6 = emptyTA6Form();
    ta6.section12.mainsGas = { ...ta6.section12.mainsGas, connected: 'not-known' };
    expect(partBFromTa6(ta6)).toEqual({});
    expect(partBFromTa6(null)).toEqual({});
  });
  it('falls back to the §12 mains sewerage answer when §11 is blank', () => {
    const ta6 = emptyTA6Form();
    ta6.section12.mainsSewerage = { connected: 'yes', provider: null };
    expect(partBFromTa6(ta6).sewerage).toBe('Mains');
  });
});

describe('buildMaterialInfo Part B', () => {
  const listing = { price: 300000, tenure: 'freehold', propertyType: 'Semi-detached', bedrooms: 3, bathrooms: 1 } as unknown as PropertyListing;
  it('takes type and rooms from the listing', () => {
    const mi = buildMaterialInfo(listing, null, {});
    expect(mi.propertyType).toEqual({ value: 'Semi-detached', source: 'listing' });
    expect(mi.bedrooms).toEqual({ value: 3, source: 'listing' });
    expect(mi.bathrooms).toEqual({ value: 1, source: 'listing' });
  });
  it("uses the seller's TA6 answers, with the agent's own entry winning", () => {
    const mi = buildMaterialInfo(listing, null, { heating: 'Air source heat pump' }, { heating: 'Gas central heating', parking: 'Driveway' });
    expect(mi.heating).toEqual({ value: 'Air source heat pump', source: 'agent' });
    expect(mi.parking).toEqual({ value: 'Driveway', source: 'seller' });
    expect(mi.mobileSignal).toEqual({ value: null, source: 'missing' });
  });
});
