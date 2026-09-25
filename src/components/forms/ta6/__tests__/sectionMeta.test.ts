// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * `stepForSectionName` is what turns a form-check finding into a link the
 * seller can follow. The function names a section two different ways
 * depending on where the finding came from, so both have to land on the same
 * step, and anything else has to refuse rather than guess.
 */
import { describe, it, expect } from 'vitest';

import { TA6_STEP_COUNT, stepForSectionName } from '../sectionMeta';

describe('stepForSectionName', () => {
  it('should resolve a bare section name, as the deterministic rules write it', () => {
    expect(stepForSectionName('section5')).toBe(5);
    expect(stepForSectionName('section11')).toBe(11);
  });

  it('should resolve a slugged section name, as the model flags write it', () => {
    expect(stepForSectionName('section5_alterations')).toBe(5);
    expect(stepForSectionName('section8_environment')).toBe(8);
  });

  it('should accept the first and last sections', () => {
    expect(stepForSectionName('section1_property')).toBe(1);
    expect(stepForSectionName(`section${TA6_STEP_COUNT}_additional`)).toBe(TA6_STEP_COUNT);
  });

  it('should refuse a section number the form does not have', () => {
    expect(stepForSectionName('section0')).toBeNull();
    expect(stepForSectionName('section16_invented')).toBeNull();
  });

  it('should refuse anything that is not a section name', () => {
    expect(stepForSectionName('')).toBeNull();
    expect(stepForSectionName('boundaries')).toBeNull();
    expect(stepForSectionName('sectionFive')).toBeNull();
    expect(stepForSectionName('xsection5')).toBeNull();
  });
});
