// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2025 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

import { describe, it, expect } from 'vitest';
import { resolvePropertyPostcode } from '../propertyFields';

describe('resolvePropertyPostcode', () => {
  it('should return the transaction postcode when it is present', () => {
    expect(resolvePropertyPostcode('SG19 1AB', 'CB1 2QT')).toBe('SG19 1AB');
  });

  it('should fall back to the listing postcode when the transaction postcode is an empty string', () => {
    // Regression guard (PR #72): the canister returns "" — not undefined — for an
    // unset postcode. `??` stopped here and blanked the Property tab; `||` falls through.
    expect(resolvePropertyPostcode('', 'CB1 2QT')).toBe('CB1 2QT');
  });

  it('should fall back to the listing postcode when the transaction postcode is undefined', () => {
    expect(resolvePropertyPostcode(undefined, 'CB1 2QT')).toBe('CB1 2QT');
  });

  it('should prefer a non-empty transaction postcode over the listing', () => {
    expect(resolvePropertyPostcode('SG19 1AB', '')).toBe('SG19 1AB');
  });

  it('should return an empty string when neither source has a postcode', () => {
    expect(resolvePropertyPostcode('', '')).toBe('');
    expect(resolvePropertyPostcode(undefined, undefined)).toBe('');
    expect(resolvePropertyPostcode('', undefined)).toBe('');
  });
});
