import { describe, it, expect } from 'vitest';
import { splitAddress, joinAddress } from '../addressSplit';

describe('splitAddress', () => {
  it('should return empty line1 for null/undefined input', () => {
    expect(splitAddress(null)).toEqual({ line1: '' });
    expect(splitAddress(undefined)).toEqual({ line1: '' });
  });

  it('should map a single part to line1', () => {
    expect(splitAddress('Ivel Road')).toEqual({ line1: 'Ivel Road', postcode: undefined });
  });

  it('should map two parts to line1 + town', () => {
    expect(splitAddress('Ivel Road, Sandy')).toEqual({
      line1: 'Ivel Road',
      town: 'Sandy',
      postcode: undefined,
    });
  });

  it('should map three parts ending in a county to line1 + town + county (Rightmove shape)', () => {
    // Regression 2026-07-22: "Ivel Road, Sandy, Bedfordshire" landed as
    // town="Bedfordshire" (the county) with Sandy relegated to line2.
    expect(splitAddress('Ivel Road, Sandy, Bedfordshire')).toEqual({
      line1: 'Ivel Road',
      town: 'Sandy',
      county: 'Bedfordshire',
      postcode: undefined,
    });
  });

  it('should recognise non-"shire" counties in third position', () => {
    expect(splitAddress('Mill Lane, Maldon, Essex')).toEqual({
      line1: 'Mill Lane',
      town: 'Maldon',
      county: 'Essex',
      postcode: undefined,
    });
  });

  it('should keep three parts NOT ending in a county as line1 + line2 + town', () => {
    expect(splitAddress('Flat 2, 10 High Street, Bedford')).toEqual({
      line1: 'Flat 2',
      line2: '10 High Street',
      town: 'Bedford',
      postcode: undefined,
    });
  });

  it('should map four+ parts to line1 + line2 + town + county', () => {
    expect(splitAddress('Flat 2, 10 High Street, Bedford, Bedfordshire')).toEqual({
      line1: 'Flat 2',
      line2: '10 High Street',
      town: 'Bedford',
      county: 'Bedfordshire',
      postcode: undefined,
    });
  });

  it('should extract and normalise a trailing postcode', () => {
    expect(splitAddress('Ivel Road, Sandy, Bedfordshire, SG19 1AX')).toEqual({
      line1: 'Ivel Road',
      town: 'Sandy',
      county: 'Bedfordshire',
      postcode: 'SG19 1AX',
    });
  });
});

describe('joinAddress', () => {
  it('should round-trip a split address back to a display string', () => {
    const parts = splitAddress('Ivel Road, Sandy, Bedfordshire, SG19 1AX');
    expect(joinAddress(parts)).toBe('Ivel Road, Sandy, Bedfordshire, SG19 1AX');
  });
});
