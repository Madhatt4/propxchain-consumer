// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd
//
// Guardrails for the TA6 help cards, sections 1-5: exactly one guide per
// section, every field populated, no Law Society wording leaking into intros,
// and intros short enough for a help card.

import { describe, it, expect } from 'vitest';

import { SECTION_GUIDES_01_05 } from '../sections01to05';

const EXPECTED_SECTIONS: readonly number[] = [1, 2, 3, 4, 5];
const MAX_INTRO_LENGTH = 400;

describe('SECTION_GUIDES_01_05', () => {
  it('should contain exactly one guide for each of sections 1 to 5', () => {
    const sections = SECTION_GUIDES_01_05.map((guide) => guide.section);

    expect(sections).toEqual(EXPECTED_SECTIONS);
  });

  it.each(EXPECTED_SECTIONS)(
    'should have a non-empty plainTitle, intro and reassurance for section %i',
    (sectionNumber: number) => {
      const guide = SECTION_GUIDES_01_05.find(
        (candidate) => candidate.section === sectionNumber,
      );

      expect(guide).toBeTruthy();
      expect(guide?.plainTitle.trim().length).toBeGreaterThan(0);
      expect(guide?.intro.trim().length).toBeGreaterThan(0);
      expect(guide?.reassurance.trim().length).toBeGreaterThan(0);
    },
  );

  it('should have a non-empty whatYoullNeed list with non-empty entries in every guide', () => {
    for (const guide of SECTION_GUIDES_01_05) {
      expect(guide.whatYoullNeed.length).toBeGreaterThan(0);
      for (const item of guide.whatYoullNeed) {
        expect(item.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("should not mention 'Law Society' in any intro (link text lives elsewhere)", () => {
    for (const guide of SECTION_GUIDES_01_05) {
      expect(guide.intro).not.toContain('Law Society');
    }
  });

  it(`should keep every intro under ${MAX_INTRO_LENGTH} characters`, () => {
    for (const guide of SECTION_GUIDES_01_05) {
      expect(guide.intro.length).toBeLessThan(MAX_INTRO_LENGTH);
    }
  });
});
