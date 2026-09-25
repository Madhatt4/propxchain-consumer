import { describe, it, expect } from 'vitest';
import type { PropertyListing, ProvenanceMap } from '@/types/listing.types';
import { listingToDetails, detailsToListing, buildEpcAutofill, buildAddressSuggestion } from '../ListPropertyStage';
import type { PropertyDetailsValue } from '../PropertyDetailsForm';
import type { EpcCertificate } from '@/services/epc.service';

const baseListing: PropertyListing = {
  url: '',
  listingId: 'manual-1',
  source: 'manual',
  address: '12 High Street, Sandy, SG19 1AB',
  postcode: 'SG19 1AB',
  price: 425000,
  propertyType: 'Detached',
  bedrooms: 3,
  tenure: 'freehold',
  priceQualifier: '',
  bathrooms: 2,
  description: '',
  keyFeatures: [],
  images: [],
  floorplanUrl: null,
  epcRating: null,
  agentName: '',
  agentBranch: '',
  agentLogoUrl: null,
  councilTaxBand: null,
  propertyPhrase: '',
  addressLine1: '12 High Street',
  town: 'Sandy',
  provenance: {} as ProvenanceMap,
};

const baseDetails: PropertyDetailsValue = {
  addressLine1: '12 High Street',
  town: 'Sandy',
  postcode: 'SG19 1AB',
  titleNumber: 'BD123456',
  price: 425000,
  tenure: 'freehold',
};

describe('listingToDetails — uprn', () => {
  it('carries a present uprn through to the form value', () => {
    const details = listingToDetails({ ...baseListing, uprn: '100023336956' }, 'BD123456');
    expect(details.uprn).toBe('100023336956');
  });

  it('yields an empty-string uprn when the listing has none', () => {
    const details = listingToDetails(baseListing, 'BD123456');
    expect(details.uprn).toBe('');
  });

  it('yields an empty-string uprn for a null listing', () => {
    const details = listingToDetails(null, 'BD123456');
    expect(details.uprn).toBe('');
  });
});

describe('listingToDetails — epcRating sanitisation', () => {
  it('should drop a non-band epcRating (EPC graph URL from the old adapter) so autofill can fill it', () => {
    // Regression 2026-07-22: the Rightmove adapter shipped the EPC graph image
    // URL as epcRating — truthy, so autofill skipped the field, but not A-G,
    // so the dropdown rendered blank. Cached listings still carry it.
    const details = listingToDetails(
      { ...baseListing, epcRating: 'https://media.rightmove.co.uk/epc/12345_EPC.png' },
      'BD123456',
    );
    expect(details.epcRating).toBeUndefined();
  });

  it('should keep a real band and normalise its case', () => {
    expect(listingToDetails({ ...baseListing, epcRating: 'c' }, 'BD123456').epcRating).toBe('C');
    expect(listingToDetails({ ...baseListing, epcRating: 'B' }, 'BD123456').epcRating).toBe('B');
  });
});

describe('detailsToListing — uprn', () => {
  it('writes a trimmed uprn and records user provenance when present', () => {
    const listing = detailsToListing({ ...baseDetails, uprn: '  100023336956  ' }, null);
    expect(listing.uprn).toBe('100023336956');
    expect(listing.provenance.uprn).toBe('user');
  });

  it('omits uprn and provenance when blank', () => {
    const listing = detailsToListing({ ...baseDetails, uprn: '' }, null);
    expect(listing.uprn).toBeUndefined();
    expect(listing.provenance.uprn).toBeUndefined();
  });

  it('drops a stale uprn provenance when the field is cleared on edit', () => {
    const withUprn: PropertyListing = {
      ...baseListing,
      uprn: '100023336956',
      provenance: { uprn: 'user' } as ProvenanceMap,
    };
    const listing = detailsToListing({ ...baseDetails, uprn: '' }, withUprn);
    expect(listing.uprn).toBeUndefined();
    expect(listing.provenance.uprn).toBeUndefined();
  });
});

describe('uprn round-trip', () => {
  it('preserves a present uprn through listing → details → listing', () => {
    const start: PropertyListing = { ...baseListing, uprn: '100023336956' };
    const details = listingToDetails(start, 'BD123456');
    const end = detailsToListing(details, start);
    expect(end.uprn).toBe('100023336956');
  });

  it('preserves an absent uprn through listing → details → listing', () => {
    const details = listingToDetails(baseListing, 'BD123456');
    const end = detailsToListing(details, baseListing);
    expect(end.uprn).toBeUndefined();
  });
});

describe('buildEpcAutofill', () => {
  const blankDetails = (over: Partial<PropertyDetailsValue> = {}): PropertyDetailsValue => ({
    addressLine1: '86 Fairfield Road',
    town: 'Biggleswade',
    postcode: 'SG18 0AA',
    titleNumber: '',
    uprn: '',
    price: '',
    tenure: 'freehold',
    ...over,
  });

  const epc = (over: Partial<EpcCertificate> = {}): EpcCertificate => ({
    address: '86 Fairfield Road, BIGGLESWADE',
    postcode: 'SG18 0AA',
    uprn: '100080064516',
    currentBand: 'C',
    potentialBand: 'B',
    currentRating: 69,
    potentialRating: 82,
    floorAreaSqm: 93,
    lodgementDate: '2023-06-13',
    meetsMees: true,
    ...over,
  });

  it('fills blank EPC rating and UPRN from the certificate', () => {
    const { updates, filledKeys } = buildEpcAutofill(blankDetails(), epc());
    expect(updates).toEqual({ epcRating: 'C', uprn: '100080064516' });
    expect(filledKeys.sort()).toEqual(['epcRating', 'uprn']);
  });

  it('never overwrites values the user already entered', () => {
    const { updates, filledKeys } = buildEpcAutofill(
      blankDetails({ epcRating: 'D', uprn: '999999999999' }),
      epc(),
    );
    expect(updates).toEqual({});
    expect(filledKeys).toEqual([]);
  });

  it('returns nothing when there is no EPC record', () => {
    const { updates, filledKeys } = buildEpcAutofill(blankDetails(), null);
    expect(updates).toEqual({});
    expect(filledKeys).toEqual([]);
  });

  it('fills only the EPC band when the register has no UPRN', () => {
    const { updates, filledKeys } = buildEpcAutofill(blankDetails(), epc({ uprn: null }));
    expect(updates).toEqual({ epcRating: 'C' });
    expect(filledKeys).toEqual(['epcRating']);
  });
});

describe('buildAddressSuggestion', () => {
  it('should suggest the EPC register line when the form address is street-only', () => {
    // Imported listings are street-only; the EPC register knows the house
    // number — surfacing it fixes the HMLR title search dead-end.
    expect(buildAddressSuggestion('Ivel Road', '20 IVEL ROAD, SANDY')).toBe('20 Ivel Road');
  });

  it('should title-case an all-caps register line', () => {
    expect(buildAddressSuggestion('Fairfield Road', '86A FAIRFIELD ROAD, BIGGLESWADE')).toBe('86A Fairfield Road');
  });

  it('should suggest a house name too', () => {
    expect(buildAddressSuggestion('Mill Lane', 'ROSE COTTAGE, MILL LANE, SANDY')).toBe('Rose Cottage');
  });

  it('should return null when the form address already has a house number', () => {
    expect(buildAddressSuggestion('20 Ivel Road', '20 IVEL ROAD, SANDY')).toBeNull();
  });

  it('should return null when the form address is a house name', () => {
    expect(buildAddressSuggestion('Rose Cottage', 'ROSE COTTAGE, SANDY')).toBeNull();
  });

  it('should return null when the register line matches the form value anyway', () => {
    // Register also street-only for this postcode — nothing to add.
    expect(buildAddressSuggestion('Ivel Road', 'IVEL ROAD, SANDY')).toBeNull();
  });

  it('should return null for a blank or missing register address', () => {
    expect(buildAddressSuggestion('Ivel Road', '')).toBeNull();
    expect(buildAddressSuggestion('Ivel Road', null)).toBeNull();
  });
});
