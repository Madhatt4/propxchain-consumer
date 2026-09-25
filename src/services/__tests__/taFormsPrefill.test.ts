// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

import { describe, it, expect } from 'vitest';
import type { PropertyListing } from '@/types/listing.types';
import { emptyTA6Form } from '@/types/ta6.types';
import { emptyTA7Form } from '@/types/ta7.types';
import {
  listingFromTa6,
  listingFromTa7,
  prefillTa6FromListing,
  prefillTa7FromListing,
} from '../taFormsPrefill';

function listing(overrides: Partial<PropertyListing> = {}): PropertyListing {
  return {
    address: '12 High Street, Sandy',
    postcode: 'SG19 1AB',
    uprn: '10000802117',
    price: 400000,
    tenure: 'leasehold',
    propertyType: 'Flat',
    epcRating: 'C',
    councilTaxBand: 'D',
    groundRentPerYear: 250,
    serviceChargePerYear: 1200,
    leaseYearsRemaining: 95,
    provenance: {},
    ...overrides,
  } as PropertyListing;
}

function inYears(n: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + n);
  return d.toISOString().slice(0, 10);
}

describe('prefillTa6FromListing', () => {
  it('should fill a blank §1 with address, postcode and UPRN', () => {
    const { form, filled } = prefillTa6FromListing(emptyTA6Form(), listing());
    expect(form.section1).toMatchObject({ propertyAddress: '12 High Street, Sandy', postcode: 'SG19 1AB', uprn: '10000802117' });
    expect(filled).toEqual(['Property address', 'Postcode', 'UPRN']);
  });

  it('should keep what the seller already typed', () => {
    const base = emptyTA6Form();
    base.section1 = { ...base.section1, propertyAddress: 'Flat 2, 12 High Street', postcode: 'SG19 1AB', uprn: '1' };
    const { form, filled } = prefillTa6FromListing(base, listing());
    expect(form).toBe(base);
    expect(filled).toEqual([]);
  });

  it('should do nothing without a listing', () => {
    const base = emptyTA6Form();
    expect(prefillTa6FromListing(base, null).form).toBe(base);
  });
});

describe('prefillTa7FromListing', () => {
  it('should fill ground rent and service charge as annual amounts', () => {
    const { form, filled } = prefillTa7FromListing(emptyTA7Form, listing());
    expect(form).toMatchObject({
      groundRentAmount: 250,
      groundRentPaymentFrequency: 'annual',
      serviceChargeAmount: 1200,
      serviceChargePaymentFrequency: 'annual',
    });
    expect(filled).toEqual(['Ground rent', 'Service charge']);
  });

  it('should not touch amounts the form already has', () => {
    const base = { ...emptyTA7Form, groundRentAmount: 100, groundRentPaymentFrequency: 'quarterly' as const };
    const { form } = prefillTa7FromListing(base, listing());
    expect(form.groundRentAmount).toBe(100);
    expect(form.groundRentPaymentFrequency).toBe('quarterly');
    expect(form.serviceChargeAmount).toBe(1200);
  });

  it('should return the same object when the listing has no lease figures', () => {
    const { form } = prefillTa7FromListing(emptyTA7Form, listing({ groundRentPerYear: undefined, serviceChargePerYear: undefined }));
    expect(form).toBe(emptyTA7Form);
  });
});

describe('listingFromTa7', () => {
  it('should fill blank lease trio from the saved form, annualising quarterly amounts', () => {
    const ta7 = {
      ...emptyTA7Form,
      leaseExpiryDate: inYears(90),
      groundRentAmount: 50,
      groundRentPaymentFrequency: 'quarterly' as const,
      serviceChargeAmount: 100,
      serviceChargePaymentFrequency: 'monthly' as const,
    };
    const out = listingFromTa7(listing({ groundRentPerYear: undefined, serviceChargePerYear: undefined, leaseYearsRemaining: undefined }), ta7);
    expect(out.groundRentPerYear).toBe(200);
    expect(out.serviceChargePerYear).toBe(1200);
    expect(out.leaseYearsRemaining).toBeGreaterThanOrEqual(89);
    expect(out.provenance.groundRentPerYear).toBe('user');
  });

  it('should leave a listing alone that already has the trio', () => {
    const input = listing();
    expect(listingFromTa7(input, { ...emptyTA7Form, groundRentAmount: 999, groundRentPaymentFrequency: 'annual' })).toBe(input);
  });
});

describe('listingFromTa6', () => {
  it('should fill a blank listing UPRN from §1 and leave a present one alone', () => {
    const ta6 = emptyTA6Form();
    ta6.section1 = { ...ta6.section1, uprn: '200000000001' };
    expect(listingFromTa6(listing({ uprn: '' }), ta6).uprn).toBe('200000000001');
    const input = listing();
    expect(listingFromTa6(input, ta6)).toBe(input);
  });
});
