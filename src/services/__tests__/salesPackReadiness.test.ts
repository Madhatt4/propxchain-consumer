// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The sales-pack readiness meter is a simple fraction of binary items
 * (decision: Madhatt4/Propxchain#115) — no weighting, TA7 counted only for
 * transactions that aren't freehold / share-of-freehold, and one searches row
 * that is done only when results are back (Marc's 2026-11-15 sign-off).
 */
import { describe, it, expect } from 'vitest';

import {
  computePackReadiness,
  isMaterialInfoComplete,
  type PackItem,
  type PackReadinessInputs,
} from '../salesPackReadiness';
import { materialInfoMissing } from '../materialInfo';
import type { PropertyListing } from '@/types/listing.types';

function listing(overrides: Partial<PropertyListing> = {}): PropertyListing {
  return {
    address: '12 High Street',
    postcode: 'SG19 1AB',
    price: 400000,
    tenure: 'freehold',
    propertyType: 'Detached',
    councilTaxBand: 'D',
    epcRating: 'C',
    ...overrides,
  } as PropertyListing;
}

function inputs(overrides: Partial<PackReadinessInputs> = {}): PackReadinessInputs {
  return {
    listing: listing(),
    titlePulled: false,
    searchesOrdered: false,
    searchesBack: false,
    ta6: false,
    ta10: false,
    ta7: false,
    idShared: false,
    registerDiscrepancies: [],
    ...overrides,
  };
}

describe('computePackReadiness warnings', () => {
  it('should turn a register discrepancy into a plain-English warning', () => {
    const r = computePackReadiness(inputs({
      registerDiscrepancies: [{ field: 'tenure', listing: 'leasehold', register: 'freehold', source: 'hmlr-register' }],
    }));
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/Tenure: the HMLR register says "freehold" but the listing says "leasehold"/);
  });

  it('should have no warnings when the registers agree', () => {
    expect(computePackReadiness(inputs()).warnings).toEqual([]);
  });
});

describe('isMaterialInfoComplete', () => {
  it('should be complete for a freehold listing with price, tenure, type and council tax band', () => {
    expect(isMaterialInfoComplete(listing())).toBe(true);
  });

  it('should be incomplete when the listing is null', () => {
    expect(isMaterialInfoComplete(null)).toBe(false);
  });

  it('should be incomplete when tenure is unknown', () => {
    expect(isMaterialInfoComplete(listing({ tenure: 'unknown' }))).toBe(false);
  });

  it('should be incomplete when price is missing or zero', () => {
    expect(isMaterialInfoComplete(listing({ price: 0 }))).toBe(false);
  });

  it('should be incomplete when council tax band is missing', () => {
    expect(isMaterialInfoComplete(listing({ councilTaxBand: null }))).toBe(false);
  });

  it('should require the leasehold cost trio for a leasehold listing', () => {
    const base = listing({ tenure: 'leasehold' });
    expect(isMaterialInfoComplete(base)).toBe(false);
    expect(
      isMaterialInfoComplete(
        listing({
          tenure: 'leasehold',
          leaseYearsRemaining: 95,
          groundRentPerYear: 250,
          serviceChargePerYear: 1200,
        }),
      ),
    ).toBe(true);
  });

  it('should accept a zero ground rent (peppercorn) on leasehold', () => {
    expect(
      isMaterialInfoComplete(
        listing({
          tenure: 'leasehold',
          leaseYearsRemaining: 95,
          groundRentPerYear: 0,
          serviceChargePerYear: 1200,
        }),
      ),
    ).toBe(true);
  });
});

describe('computePackReadiness', () => {
  it('should count 7 items for a freehold transaction (no TA7)', () => {
    const r = computePackReadiness(inputs());
    expect(r.total).toBe(7);
    expect(r.items.map((i) => i.id)).not.toContain('ta7');
  });

  it('should count 8 items for a leasehold transaction', () => {
    const r = computePackReadiness(
      inputs({
        listing: listing({
          tenure: 'leasehold',
          leaseYearsRemaining: 95,
          groundRentPerYear: 0,
          serviceChargePerYear: 900,
        }),
      }),
    );
    expect(r.total).toBe(8);
    expect(r.items.map((i) => i.id)).toContain('ta7');
  });

  it('should include TA7 when tenure is unknown, mirroring the forms stage', () => {
    const r = computePackReadiness(inputs({ listing: listing({ tenure: 'unknown' }) }));
    expect(r.items.map((i) => i.id)).toContain('ta7');
  });

  it('should include TA7 when the listing is missing entirely', () => {
    const r = computePackReadiness(inputs({ listing: null }));
    expect(r.items.map((i) => i.id)).toContain('ta7');
  });

  it('should exclude TA7 for share of freehold', () => {
    const r = computePackReadiness(
      inputs({ listing: listing({ tenure: 'shareOfFreehold' }) }),
    );
    expect(r.items.map((i) => i.id)).not.toContain('ta7');
  });

  it('should report zero done when nothing is in place beyond material info and EPC', () => {
    const r = computePackReadiness(inputs());
    expect(r.done).toBe(2); // materialInfo + epc from the default listing
  });

  it('should report all done for a fully assembled freehold pack', () => {
    const r = computePackReadiness(
      inputs({
        titlePulled: true,
        searchesOrdered: true,
        searchesBack: true,
        ta6: true,
        ta10: true,
        idShared: true,
      }),
    );
    expect(r.done).toBe(7);
    expect(r.done).toBe(r.total);
  });

  it('should say the rating was found on the national register when the listing has a band', () => {
    const r = computePackReadiness(inputs());
    expect(r.items.find((i) => i.id === 'epc')).toMatchObject({
      done: true,
      status: 'Rating C, found on the national register',
    });
  });

  it('should mark epc not done when the listing has no band', () => {
    const r = computePackReadiness(inputs({ listing: listing({ epcRating: null }) }));
    expect(r.items.find((i) => i.id === 'epc')?.done).toBe(false);
  });

  it('should give every item a human label', () => {
    for (const item of computePackReadiness(inputs({ listing: null })).items) {
      expect(item.label.length).toBeGreaterThan(3);
    }
  });
});

describe('computePackReadiness order', () => {
  it('should list the rows in the signed-off order without TA7 for freehold', () => {
    expect(computePackReadiness(inputs()).items.map((i) => i.id)).toEqual([
      'materialInfo', 'epc', 'titlePulled', 'ta6', 'ta10', 'searches', 'idShared',
    ]);
  });

  it('should put TA7 after TA10 and before searches when the home could be leasehold', () => {
    const r = computePackReadiness(inputs({ listing: listing({ tenure: 'unknown' }) }));
    expect(r.items.map((i) => i.id)).toEqual([
      'materialInfo', 'epc', 'titlePulled', 'ta6', 'ta10', 'ta7', 'searches', 'idShared',
    ]);
    expect(r.items.find((i) => i.id === 'ta7')?.status).toBe('Only if leasehold');
  });

  it('should use the signed-off row titles', () => {
    const labels = computePackReadiness(inputs({ listing: listing({ tenure: 'leasehold' }) })).items.map((i) => i.label);
    expect(labels).toEqual([
      'About your property',
      'Energy Performance Certificate (EPC)',
      'Title register',
      'Property information form (TA6)',
      'Fittings and contents form (TA10)',
      'Leasehold information form (TA7)',
      'Property searches',
      'Proof of identity',
    ]);
  });
});

describe('computePackReadiness searches row', () => {
  function searches(isOrdered: boolean, isBack: boolean): PackItem | undefined {
    return computePackReadiness(inputs({ searchesOrdered: isOrdered, searchesBack: isBack })).items.find((i) => i.id === 'searches');
  }

  it('should say "Not ordered" and be not done before anything is ordered', () => {
    expect(searches(false, false)).toMatchObject({ done: false, status: 'Not ordered', searchesState: 'notOrdered' });
  });

  it('should say it is waiting and stay not done once ordered', () => {
    expect(searches(true, false)).toMatchObject({ done: false, status: 'Ordered, waiting for results', searchesState: 'ordered' });
  });

  it('should be done only when results are back', () => {
    expect(searches(true, true)).toMatchObject({ done: true, status: 'Results back', searchesState: 'back' });
  });
});

describe('computePackReadiness title row', () => {
  const title = (over: Partial<PackReadinessInputs>): PackItem | undefined =>
    computePackReadiness(inputs(over)).items.find((i) => i.id === 'titlePulled');

  it('should carry the title number the pull needs', () => {
    expect(title({ titleNumber: 'GR506405' })).toMatchObject({ done: false, status: 'Not pulled yet', titleNumber: 'GR506405' });
  });

  it('should say why it cannot be pulled when there is no title number', () => {
    const item = title({});
    expect(item?.status).toBe('Not pulled yet. Add your title number first');
    expect(item?.titleNumber).toBeUndefined();
  });

  it('should read pulled once a register exists', () => {
    expect(title({ titlePulled: true, titleNumber: 'GR506405' })).toMatchObject({ done: true, status: 'Pulled from HM Land Registry' });
  });
});

describe('materialInfoMissing', () => {
  it('should return nothing for a complete freehold listing', () => {
    expect(materialInfoMissing(listing())).toEqual([]);
  });

  it('should return every core field when there is no listing', () => {
    expect(materialInfoMissing(null)).toEqual(['address', 'postcode', 'price', 'tenure', 'propertyType', 'councilTaxBand']);
  });

  it.each([
    ['address', { address: '  ' }],
    ['postcode', { postcode: '' }],
    ['price', { price: 0 }],
    ['tenure', { tenure: 'unknown' as const }],
    ['propertyType', { propertyType: '' }],
    ['councilTaxBand', { councilTaxBand: null }],
  ])('should report %s when it is missing', (field, overrides) => {
    expect(materialInfoMissing(listing(overrides as Partial<PropertyListing>))).toEqual([field]);
  });

  it('should report the whole lease trio for a leasehold listing without lease details', () => {
    expect(materialInfoMissing(listing({ tenure: 'leasehold' }))).toEqual([
      'leaseYearsRemaining', 'groundRentPerYear', 'serviceChargePerYear',
    ]);
  });

  it('should report each lease field on its own', () => {
    const lease = { tenure: 'leasehold' as const, leaseYearsRemaining: 90, groundRentPerYear: 0, serviceChargePerYear: 900 };
    expect(materialInfoMissing(listing({ ...lease, leaseYearsRemaining: 0 }))).toEqual(['leaseYearsRemaining']);
    expect(materialInfoMissing(listing({ ...lease, groundRentPerYear: undefined }))).toEqual(['groundRentPerYear']);
    expect(materialInfoMissing(listing({ ...lease, serviceChargePerYear: -1 }))).toEqual(['serviceChargePerYear']);
  });

  it('should not ask for lease details on a freehold listing', () => {
    expect(materialInfoMissing(listing({ tenure: 'freehold', leaseYearsRemaining: undefined }))).toEqual([]);
  });
});

describe('computePackReadiness material info row', () => {
  it('should name the missing fields in plain words', () => {
    const item = computePackReadiness(inputs({ listing: listing({ councilTaxBand: null, tenure: 'unknown' }) })).items[0];
    expect(item).toMatchObject({ id: 'materialInfo', done: false, status: 'Missing: tenure, council tax band' });
    expect(item.missing).toEqual(['tenure', 'councilTaxBand']);
  });

  it('should carry no missing line once complete', () => {
    const item = computePackReadiness(inputs()).items[0];
    expect(item.done).toBe(true);
    expect(item.status).toBeUndefined();
  });
});
