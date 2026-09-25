// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PropertyListing } from '@/types/listing.types';
import type { HmlrRegisterExtract } from '../hmlrTitle.service';
import type { PricePaidRecord } from '../landRegistryService';

const getStoredRegisterForTransaction = vi.fn<(id: string) => Promise<HmlrRegisterExtract | null>>();
const fetchPriceHistory = vi.fn();
const storeRightmoveData = vi.fn(async () => ({ ok: true }));

vi.mock('../hmlrTitle.service', async (importActual) => {
  const actual = await importActual<typeof import('../hmlrTitle.service')>();
  return {
    ...actual,
    hmlrTitleService: { getStoredRegisterForTransaction: (id: string) => getStoredRegisterForTransaction(id) },
  };
});
vi.mock('../landRegistryService', async (importActual) => {
  const actual = await importActual<typeof import('../landRegistryService')>();
  return { ...actual, fetchPriceHistory: (pc: string) => fetchPriceHistory(pc) };
});
vi.mock('@/utils/rightmoveStorage', () => ({
  storeRightmoveData: (...a: unknown[]) => storeRightmoveData(...(a as [])),
}));

import {
  applyPricePaidTenure,
  applyRegisterFacts,
  enrichListingFromRegisters,
  normaliseRegisterTenure,
} from '../listingFactsFromRegister';

function listing(overrides: Partial<PropertyListing> = {}): PropertyListing {
  return {
    address: '12 High Street, Sandy, Bedfordshire',
    addressLine1: '',
    postcode: 'SG19 1AB',
    price: 400000,
    tenure: 'unknown',
    propertyType: 'Detached',
    epcRating: null,
    councilTaxBand: null,
    provenance: {},
    ...overrides,
  } as PropertyListing;
}

function register(overrides: Partial<HmlrRegisterExtract> = {}): HmlrRegisterExtract {
  return {
    titleNumber: 'BD123456',
    messageId: 'm',
    registeredAddress: '12 High Street, Sandy, SG19 1AB',
    addressLines: ['12 High Street', 'Sandy', 'SG19 1AB'],
    classOfTitle: 'Absolute',
    tenure: 'Freehold',
    editionDate: '',
    officialCopyDateTime: '',
    proprietors: [{ name: 'Priscilla Proprietor Canary' } as never],
    charges: [],
    hasCharges: false,
    hasRestrictions: false,
    hasCautions: false,
    hasNotices: false,
    leaseCount: 0,
    titlePlanZipBase64: null,
    typeCode: 30,
    raw: '',
    ...overrides,
  };
}

function sale(duration: string): PricePaidRecord {
  return {
    transactionId: 't',
    price: 350000,
    dateOfTransfer: '2021-03-01',
    postcode: 'SG19 1AB',
    propertyType: 'D',
    newBuild: false,
    duration,
    paon: '12',
    saon: '',
    street: 'HIGH STREET',
    locality: '',
    townCity: 'SANDY',
    district: '',
    county: '',
  } as unknown as PricePaidRecord;
}

beforeEach(() => {
  getStoredRegisterForTransaction.mockReset();
  fetchPriceHistory.mockReset();
  storeRightmoveData.mockClear();
});

describe('normaliseRegisterTenure', () => {
  it('should map HMLR labels and reject anything else', () => {
    expect(normaliseRegisterTenure('Freehold')).toBe('freehold');
    expect(normaliseRegisterTenure(' leasehold ')).toBe('leasehold');
    expect(normaliseRegisterTenure('Commonhold')).toBeNull();
    expect(normaliseRegisterTenure('')).toBeNull();
  });
});

describe('applyRegisterFacts', () => {
  it('should fill an unknown tenure and blank address line, tagged hmlr-register', () => {
    const out = applyRegisterFacts(listing(), register());
    expect(out.changed).toBe(true);
    expect(out.listing.tenure).toBe('freehold');
    expect(out.listing.addressLine1).toBe('12 High Street');
    expect(out.listing.provenance.tenure).toBe('hmlr-register');
    expect(out.listing.provenance.addressLine1).toBe('hmlr-register');
    expect(out.discrepancies).toEqual([]);
  });

  it('should never copy proprietor names onto the listing', () => {
    const out = applyRegisterFacts(listing(), register());
    expect(JSON.stringify(out.listing)).not.toContain('Canary');
  });

  it('should flag, not overwrite, a tenure the seller entered differently', () => {
    const out = applyRegisterFacts(listing({ tenure: 'leasehold' }), register({ tenure: 'Freehold' }));
    expect(out.listing.tenure).toBe('leasehold');
    expect(out.discrepancies).toEqual([
      { field: 'tenure', listing: 'leasehold', register: 'freehold', source: 'hmlr-register' },
    ]);
  });

  it('should treat share of freehold against a leasehold register as agreement', () => {
    const out = applyRegisterFacts(listing({ tenure: 'shareOfFreehold' }), register({ tenure: 'Leasehold' }));
    expect(out.discrepancies).toEqual([]);
  });

  it('should flag a postcode clash but not an outcode-only import', () => {
    const clash = applyRegisterFacts(listing({ postcode: 'SG19 2ZZ' }), register());
    expect(clash.discrepancies.map((d) => d.field)).toEqual(['postcode']);
    const partial = applyRegisterFacts(listing({ postcode: 'SG19' }), register());
    expect(partial.discrepancies).toEqual([]);
    const registerPartial = applyRegisterFacts(listing(), register({ registeredAddress: '12 High Street, Sandy, SG19' }));
    expect(registerPartial.discrepancies).toEqual([]);
  });

  it('should return the same object when nothing was filled', () => {
    const input = listing({ tenure: 'freehold', addressLine1: '12 High Street' });
    const out = applyRegisterFacts(input, register());
    expect(out.listing).toBe(input);
    expect(out.changed).toBe(false);
  });
});

describe('applyPricePaidTenure', () => {
  it('should fill an unknown tenure from the sale duration, tagged land-registry-ppd', () => {
    const out = applyPricePaidTenure(listing(), sale('L'));
    expect(out.listing.tenure).toBe('leasehold');
    expect(out.listing.provenance.tenure).toBe('land-registry-ppd');
  });

  it('should leave a known tenure alone', () => {
    const input = listing({ tenure: 'freehold' });
    expect(applyPricePaidTenure(input, sale('L')).listing).toBe(input);
  });
});

describe('enrichListingFromRegisters', () => {
  it('should prefer the HMLR register and persist when it filled something', async () => {
    getStoredRegisterForTransaction.mockResolvedValue(register());
    const out = await enrichListingFromRegisters('tx-1', listing());
    expect(out.listing.tenure).toBe('freehold');
    expect(fetchPriceHistory).not.toHaveBeenCalled();
    expect(storeRightmoveData).toHaveBeenCalledWith('tx-1', out.listing);
  });

  it('should fall back to the matching price-paid sale when no register is held', async () => {
    getStoredRegisterForTransaction.mockResolvedValue(null);
    fetchPriceHistory.mockResolvedValue({ success: true, records: [sale('F'), { ...sale('L'), paon: '14' }] });
    const out = await enrichListingFromRegisters('tx-1', listing());
    expect(out.listing.tenure).toBe('freehold');
    expect(storeRightmoveData).toHaveBeenCalled();
  });

  it('should not write when nothing changed', async () => {
    getStoredRegisterForTransaction.mockResolvedValue(null);
    fetchPriceHistory.mockResolvedValue({ success: true, records: [] });
    const input = listing();
    const out = await enrichListingFromRegisters('tx-1', input);
    expect(out.listing).toBe(input);
    expect(storeRightmoveData).not.toHaveBeenCalled();
  });

  it('should survive a failing register source', async () => {
    getStoredRegisterForTransaction.mockRejectedValue(new Error('down'));
    fetchPriceHistory.mockRejectedValue(new Error('down'));
    const out = await enrichListingFromRegisters('tx-1', listing());
    expect(out.changed).toBe(false);
  });
});
