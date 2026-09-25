// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import {
  parsePafAddress,
  pafAddressFromParts,
  hasUsableStructuredAddress,
} from '../pafAddress';

describe('pafAddressFromParts', () => {
  it('should map a named building with no street from separate form fields', () => {
    const result = pafAddressFromParts(
      { addressLine1: 'Buckingham Palace', town: 'London', postcode: 'SW1A 1AA' },
      'Westminster',
    );

    expect(result.buildingName).toBe('Buckingham Palace');
    expect(result.postTown).toBe('London');
    expect(result.postCode).toBe('SW1A 1AA');
  });

  it('should not require the user to type commas into separate fields', () => {
    // The form has distinct inputs, so nothing the user types contains a
    // comma. This is the case the string parser could never get right.
    const result = pafAddressFromParts({
      addressLine1: '10 Downing Street',
      town: 'London',
      postcode: 'SW1A 2AA',
    });

    expect(result.buildingNumber).toBe('10');
    expect(result.thoroughfareName).toBe('Downing Street');
    expect(result.postTown).toBe('London');
  });

  it('should treat line 2 as the thoroughfare when line 1 is a building name', () => {
    const result = pafAddressFromParts({
      addressLine1: 'The Old Rectory',
      addressLine2: 'Church Lane',
      town: 'Sandy',
      county: 'Bedfordshire',
      postcode: 'SG19 1AX',
    });

    expect(result.buildingName).toBe('The Old Rectory');
    expect(result.thoroughfareName).toBe('Church Lane');
    expect(result.county).toBe('Bedfordshire');
  });

  it('should treat a flat on line 1 as a sub-building', () => {
    const result = pafAddressFromParts({
      addressLine1: 'Flat 2',
      addressLine2: '10 Downing Street',
      town: 'London',
      postcode: 'SW1A 2AA',
    });

    expect(result.subBuildingName).toBe('Flat 2');
    expect(result.buildingNumber).toBe('10');
    expect(result.thoroughfareName).toBe('Downing Street');
  });

  it('should fall back to the local authority when no town was entered', () => {
    const result = pafAddressFromParts(
      { addressLine1: 'Buckingham Palace', postcode: 'SW1A 1AA' },
      'Westminster',
    );

    expect(result.postTown).toBe('Westminster');
  });

  it('should normalise a postcode typed without a space', () => {
    const result = pafAddressFromParts({
      addressLine1: '10 Downing Street',
      town: 'London',
      postcode: 'sw1a2aa',
    });

    expect(result.postCode).toBe('SW1A 2AA');
  });
});

describe('hasUsableStructuredAddress', () => {
  it('should require address line 1', () => {
    expect(hasUsableStructuredAddress({ addressLine1: 'Buckingham Palace' })).toBe(true);
    expect(hasUsableStructuredAddress({ town: 'London', postcode: 'SW1A 1AA' })).toBe(false);
    expect(hasUsableStructuredAddress({ addressLine1: '   ' })).toBe(false);
    expect(hasUsableStructuredAddress(undefined)).toBe(false);
  });
});

describe('parsePafAddress', () => {
  it('should split a numbered street address into building number and thoroughfare', () => {
    const result = parsePafAddress('10 Downing Street, London, SW1A 2AA', 'SW1A 2AA', 'Westminster');

    expect(result.buildingNumber).toBe('10');
    expect(result.thoroughfareName).toBe('Downing Street');
    expect(result.postTown).toBe('London');
    expect(result.postCode).toBe('SW1A 2AA');
    expect(result.buildingName).toBeUndefined();
  });

  it('should keep a number suffix with the building number', () => {
    const result = parsePafAddress('221B Baker Street, London, NW1 6XE', 'NW1 6XE', 'Westminster');

    expect(result.buildingNumber).toBe('221B');
    expect(result.thoroughfareName).toBe('Baker Street');
  });

  it('should treat a single unnumbered line as a building name with no thoroughfare', () => {
    const result = parsePafAddress('Buckingham Palace, London, SW1A 1AA', 'SW1A 1AA', 'Westminster');

    expect(result.buildingName).toBe('Buckingham Palace');
    expect(result.thoroughfareName).toBeUndefined();
    expect(result.postTown).toBe('London');
  });

  it('should split a named building on a street into building name and thoroughfare', () => {
    const result = parsePafAddress(
      'The Old Rectory, Church Lane, Sandy, SG19 1AX',
      'SG19 1AX',
      'Central Bedfordshire',
    );

    expect(result.buildingName).toBe('The Old Rectory');
    expect(result.thoroughfareName).toBe('Church Lane');
    expect(result.postTown).toBe('Sandy');
    expect(result.buildingNumber).toBeUndefined();
  });

  it('should recognise a flat as a sub-building alongside a numbered street', () => {
    const result = parsePafAddress(
      'Flat 2, 10 Downing Street, London, SW1A 2AA',
      'SW1A 2AA',
      'Westminster',
    );

    expect(result.subBuildingName).toBe('Flat 2');
    expect(result.buildingNumber).toBe('10');
    expect(result.thoroughfareName).toBe('Downing Street');
  });

  it('should keep both sub-building and building name when all three are present', () => {
    const result = parsePafAddress(
      'Flat 2, Rose Court, Church Lane, Sandy, SG19 1AX',
      'SG19 1AX',
      'Central Bedfordshire',
    );

    expect(result.subBuildingName).toBe('Flat 2');
    expect(result.buildingName).toBe('Rose Court');
    expect(result.thoroughfareName).toBe('Church Lane');
  });

  it('should not repeat the postcode as a line of the address', () => {
    const result = parsePafAddress('10 Downing Street, London, SW1A 2AA', 'SW1A 2AA', 'Westminster');

    expect(result.postTown).toBe('London');
    expect(result.thoroughfareName).toBe('Downing Street');
  });

  it('should normalise a postcode written without a space', () => {
    const result = parsePafAddress('10 Downing Street, London', 'sw1a2aa', 'Westminster');

    expect(result.postCode).toBe('SW1A 2AA');
  });

  it('should fall back to the local authority for post town when the address has one line', () => {
    const result = parsePafAddress('SG19 1AX', 'SG19 1AX', 'Central Bedfordshire');

    expect(result.postTown).toBe('Central Bedfordshire');
  });

  it('should fall back to the postcode when there is no address and no local authority', () => {
    const result = parsePafAddress('', 'SG19 1AX', '');

    expect(result.postTown).toBe('SG19 1AX');
    expect(result.postCode).toBe('SG19 1AX');
  });

  it('should ignore empty segments from trailing or doubled commas', () => {
    const result = parsePafAddress('10 Downing Street,, London, ', 'SW1A 2AA', 'Westminster');

    expect(result.buildingNumber).toBe('10');
    expect(result.thoroughfareName).toBe('Downing Street');
    expect(result.postTown).toBe('London');
  });

  it('should always produce a premises identifier for a well-formed address', () => {
    const addresses = [
      '10 Downing Street, London, SW1A 2AA',
      'Buckingham Palace, London, SW1A 1AA',
      'The Old Rectory, Church Lane, Sandy, SG19 1AX',
      'Flat 2, 10 Downing Street, London, SW1A 2AA',
    ];

    for (const address of addresses) {
      const result = parsePafAddress(address, 'SW1A 1AA', 'Westminster');
      // PISCES rejects an order with neither. This is the invariant that
      // matters — the exact field is less important than having one.
      expect(Boolean(result.buildingName || result.buildingNumber)).toBe(true);
    }
  });
});
