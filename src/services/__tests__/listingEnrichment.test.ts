// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PropertyListing } from '@/types/listing.types';
import type { EpcCertificate } from '../epc.service';

const getEpcCached = vi.fn<(postcode: string, addressLine?: string) => Promise<EpcCertificate | null>>();
const storeRightmoveData = vi.fn(async () => ({ ok: true }));
const getRightmoveData = vi.fn<(id: string) => PropertyListing | null>();

vi.mock('../propertyIntelligenceService', () => ({ getEpcCached: (...a: [string, string?]) => getEpcCached(...a) }));
vi.mock('@/utils/rightmoveStorage', () => ({
  storeRightmoveData: (...a: unknown[]) => storeRightmoveData(...(a as [])),
  getRightmoveData: (id: string) => getRightmoveData(id),
}));

import {
  applyReportEpcToListing,
  enrichAndStoreListing,
  enrichListingFromPublicRecords,
  needsPublicRecordEnrichment,
} from '../listingEnrichment';

function listing(overrides: Partial<PropertyListing> = {}): PropertyListing {
  return {
    address: 'Headmaster Way, Macclesfield',
    postcode: 'SK10 1JD',
    price: 800000,
    tenure: 'unknown',
    propertyType: 'Penthouse',
    epcRating: null,
    councilTaxBand: null,
    provenance: {},
    ...overrides,
  } as PropertyListing;
}

function cert(overrides: Partial<EpcCertificate> = {}): EpcCertificate {
  return {
    address: '1 Headmaster Way',
    postcode: 'SK10 1JD',
    uprn: '100012345678',
    currentBand: 'C',
    potentialBand: 'B',
    currentRating: 72,
    potentialRating: 84,
    floorAreaSqm: 120,
    lodgementDate: '2024-01-01',
    meetsMees: true,
    ...overrides,
  };
}

beforeEach(() => {
  getEpcCached.mockReset();
  getRightmoveData.mockReset();
  storeRightmoveData.mockClear();
});

describe('applyReportEpcToListing (Property tab write-back)', () => {
  it('should write the report EPC onto the stored listing and report a change', () => {
    getRightmoveData.mockReturnValue(listing());
    expect(applyReportEpcToListing('tx-1', cert())).toBe(true);
    expect(storeRightmoveData).toHaveBeenCalledWith(
      'tx-1',
      expect.objectContaining({ epcRating: 'C', uprn: '100012345678' }),
    );
  });

  it('should do nothing when the listing already has the band', () => {
    getRightmoveData.mockReturnValue(listing({ epcRating: 'B', uprn: '1' }));
    expect(applyReportEpcToListing('tx-1', cert())).toBe(false);
    expect(storeRightmoveData).not.toHaveBeenCalled();
  });

  it('should do nothing when there is no stored listing or no certificate', () => {
    getRightmoveData.mockReturnValue(null);
    expect(applyReportEpcToListing('tx-1', cert())).toBe(false);
    getRightmoveData.mockReturnValue(listing());
    expect(applyReportEpcToListing('tx-1', null)).toBe(false);
    expect(storeRightmoveData).not.toHaveBeenCalled();
  });
});

describe('needsPublicRecordEnrichment', () => {
  it('should be true when the EPC band is blank', () => {
    expect(needsPublicRecordEnrichment(listing())).toBe(true);
  });

  it('should be false when band and UPRN are both present', () => {
    expect(needsPublicRecordEnrichment(listing({ epcRating: 'C', uprn: '1' }))).toBe(false);
  });

  it('should be false when there is no listing or no postcode to look up', () => {
    expect(needsPublicRecordEnrichment(null)).toBe(false);
    expect(needsPublicRecordEnrichment(listing({ postcode: '' }))).toBe(false);
  });
});

describe('enrichListingFromPublicRecords', () => {
  it('should fill a blank EPC band and UPRN from the register and tag provenance', async () => {
    getEpcCached.mockResolvedValue(cert());
    const out = await enrichListingFromPublicRecords(listing());
    expect(out.epcRating).toBe('C');
    expect(out.uprn).toBe('100012345678');
    expect(out.provenance.epcRating).toBe('epc-register');
    expect(out.provenance.uprn).toBe('epc-register');
  });

  it('should never overwrite a band the listing already has', async () => {
    getEpcCached.mockResolvedValue(cert({ currentBand: 'C' }));
    const out = await enrichListingFromPublicRecords(listing({ epcRating: 'D' }));
    expect(out.epcRating).toBe('D');
  });

  it('should return the same object when the register has nothing', async () => {
    getEpcCached.mockResolvedValue(null);
    const input = listing();
    expect(await enrichListingFromPublicRecords(input)).toBe(input);
  });

  it('should skip the lookup entirely when nothing is missing', async () => {
    const input = listing({ epcRating: 'B', uprn: '1' });
    expect(await enrichListingFromPublicRecords(input)).toBe(input);
    expect(getEpcCached).not.toHaveBeenCalled();
  });
});

describe('enrichAndStoreListing', () => {
  it('should persist only when something was filled', async () => {
    getEpcCached.mockResolvedValue(cert());
    const out = await enrichAndStoreListing('tx-1', listing());
    expect(storeRightmoveData).toHaveBeenCalledWith('tx-1', out);
  });

  it('should not write when the register returns nothing', async () => {
    getEpcCached.mockResolvedValue(null);
    await enrichAndStoreListing('tx-1', listing());
    expect(storeRightmoveData).not.toHaveBeenCalled();
  });
});
