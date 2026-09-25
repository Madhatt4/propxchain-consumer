// Contract tests for the TA6 §11–§15 plain-English help cards.
import { describe, it, expect } from 'vitest';

import { SECTION_GUIDES_11_15 } from '../sections11to15';

const EXPECTED_SECTIONS = [11, 12, 13, 14, 15];

describe('SECTION_GUIDES_11_15', () => {
  it('should contain exactly one guide per expected section number', () => {
    const sections = SECTION_GUIDES_11_15.map((guide) => guide.section);

    expect(sections).toEqual(EXPECTED_SECTIONS);
    expect(new Set(sections).size).toBe(EXPECTED_SECTIONS.length);
  });

  it.each(EXPECTED_SECTIONS)(
    'should have all fields non-empty for section %i',
    (sectionNumber) => {
      const guide = SECTION_GUIDES_11_15.find((g) => g.section === sectionNumber);

      expect(guide).toBeTruthy();
      expect(guide?.plainTitle.trim().length).toBeGreaterThan(0);
      expect(guide?.intro.trim().length).toBeGreaterThan(0);
      expect(guide?.reassurance.trim().length).toBeGreaterThan(0);
    }
  );

  it('should have a non-empty whatYoullNeed array with non-empty items in every guide', () => {
    for (const guide of SECTION_GUIDES_11_15) {
      expect(guide.whatYoullNeed.length).toBeGreaterThan(0);
      for (const item of guide.whatYoullNeed) {
        expect(item.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('should not mention "Law Society" in any intro (link text lives elsewhere)', () => {
    for (const guide of SECTION_GUIDES_11_15) {
      expect(guide.intro).not.toContain('Law Society');
    }
  });

  it('should keep every intro under 400 characters', () => {
    for (const guide of SECTION_GUIDES_11_15) {
      expect(guide.intro.length).toBeLessThan(400);
    }
  });
});
