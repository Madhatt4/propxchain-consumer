// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * The sales-pack readiness meter is a simple fraction of binary items
 * (decision: Madhatt4/Propxchain#115) — no weighting, TA7 counted only for
 * transactions that aren't freehold / share-of-freehold, searches split into
 * "ordered" and "back".
 */
import { describe, it, expect } from 'vitest';

import {
  computePackReadiness,
  isMaterialInfoComplete,
  type PackReadinessInputs,
} from '../salesPackReadiness';
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
  it('should count 8 items for a freehold transaction (no TA7)', () => {
    const r = computePackReadiness(inputs());
    expect(r.total).toBe(8);
    expect(r.items.map((i) => i.id)).not.toContain('ta7');
  });

  it('should count 9 items for a leasehold transaction', () => {
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
    expect(r.total).toBe(9);
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
    expect(r.done).toBe(8);
    expect(r.done).toBe(r.total);
  });

  it('should mark epc not done when the listing has no band', () => {
    const r = computePackReadiness(inputs({ listing: listing({ epcRating: null }) }));
    expect(r.items.find((i) => i.id === 'epc')?.done).toBe(false);
  });

  it('should treat searches ordered and searches back as separate items', () => {
    const r = computePackReadiness(inputs({ searchesOrdered: true, searchesBack: false }));
    expect(r.items.find((i) => i.id === 'searchesOrdered')?.done).toBe(true);
    expect(r.items.find((i) => i.id === 'searchesBack')?.done).toBe(false);
  });

  it('should give every item a human label', () => {
    for (const item of computePackReadiness(inputs({ listing: null })).items) {
      expect(item.label.length).toBeGreaterThan(3);
    }
  });
});
