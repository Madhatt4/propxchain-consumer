import { describe, it, expect } from 'vitest';

import { computeBundleComparison, computeAllBundleComparisons } from '../bundleComparison';
import { groundsureBundleContents } from '../groundsureBundleContents';

/**
 * The shipped mapping is empty on purpose, so every test that needs a
 * populated one mutates it and restores afterwards. Mutating the imported
 * object (rather than vi.mock) keeps the real ids under test.
 */
function withMapping(mapping: Record<string, string[]>, run: () => void): void {
  const original = { ...groundsureBundleContents };
  for (const key of Object.keys(groundsureBundleContents)) {
    delete groundsureBundleContents[key];
  }
  Object.assign(groundsureBundleContents, mapping);
  try {
    run();
  } finally {
    for (const key of Object.keys(groundsureBundleContents)) {
      delete groundsureBundleContents[key];
    }
    Object.assign(groundsureBundleContents, original);
  }
}

describe('computeBundleComparison', () => {
  it('should return null when the bundle has no contents mapping', () => {
    expect(computeBundleComparison('groundsure-homebuyers')).toBeNull();
  });

  it('should return null for an unknown bundle id', () => {
    withMapping({ 'groundsure-homebuyers': ['groundsure-flood'] }, () => {
      expect(computeBundleComparison('not-a-bundle')).toBeNull();
    });
  });

  it('should return null when a mapped single id does not resolve', () => {
    withMapping({ 'groundsure-homebuyers': ['not-a-single'] }, () => {
      expect(computeBundleComparison('groundsure-homebuyers')).toBeNull();
    });
  });

  it('should report a positive saving when the bundle is cheaper than its singles', () => {
    // Homebuyers £92.60 vs Planning £40.50 + Flood £40.50 + GeoRisk+ £64.00 = £145.00
    withMapping(
      {
        'groundsure-homebuyers': [
          'groundsure-planning',
          'groundsure-flood',
          'groundsure-georisk-plus',
        ],
      },
      () => {
        const result = computeBundleComparison('groundsure-homebuyers');
        expect(result).not.toBeNull();
        expect(result?.bundlePence).toBe(11112);
        expect(result?.singlesPence).toBe(17400);
        expect(result?.savingPence).toBe(6288);
      },
    );
  });

  it('should report a negative saving when the singles are cheaper than the bundle', () => {
    // Homebuyers £111.12 vs Planning £48.60 alone, both inc VAT
    withMapping({ 'groundsure-homebuyers': ['groundsure-planning'] }, () => {
      const result = computeBundleComparison('groundsure-homebuyers');
      expect(result?.singlesPence).toBe(4860);
      expect(result?.savingPence).toBe(-6252);
    });
  });

  it('should sum every mapped single, not just the first', () => {
    // Homescreen £75.54 vs Planning £48.60 + Flood £48.60 = £97.20, inc VAT.
    // Guards the reduce: a bug returning only singles[0] would give £48.60
    // and flip the sign of the saving.
    withMapping({ 'groundsure-homescreen': ['groundsure-planning', 'groundsure-flood'] }, () => {
      const result = computeBundleComparison('groundsure-homescreen');
      expect(result?.singlesPence).toBe(9720);
      expect(result?.savingPence).toBe(2166);
    });
  });

  it('should keep saving equal to singles minus bundle at every boundary', () => {
    // No real pair sums exactly to a bundle price, so this asserts the
    // formula's shape rather than a hardcoded zero — catching a truthy-check
    // or rounding bug that a single fixed example would miss.
    withMapping({ 'groundsure-homebuyers': ['groundsure-planning'] }, () => {
      const result = computeBundleComparison('groundsure-homebuyers');
      expect(result).not.toBeNull();
      expect(result?.savingPence).toBe(
        (result?.singlesPence ?? 0) - (result?.bundlePence ?? 0),
      );
    });
  });

  it('should return an empty array from computeAllBundleComparisons with the shipped empty mapping', () => {
    expect(computeAllBundleComparisons()).toEqual([]);
  });

  it('should return only the mapped bundles from computeAllBundleComparisons', () => {
    withMapping({ 'groundsure-homebuyers': ['groundsure-planning'] }, () => {
      const all = computeAllBundleComparisons();
      expect(all.map((c) => c.bundleId)).toEqual(['groundsure-homebuyers']);
    });
  });
});
