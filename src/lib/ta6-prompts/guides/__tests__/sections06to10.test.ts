// Tests for the plain-English help cards covering TA6 sections 6-10.

import { describe, expect, it } from 'vitest';

import { SECTION_GUIDES_06_10 } from '../sections06to10';

const EXPECTED_SECTIONS = [6, 7, 8, 9, 10];

describe('SECTION_GUIDES_06_10', () => {
  it('should contain exactly one guide per section 6 through 10', () => {
    const sections = SECTION_GUIDES_06_10.map((guide) => guide.section);
    expect([...sections].sort((a, b) => a - b)).toEqual(EXPECTED_SECTIONS);
    expect(new Set(sections).size).toBe(EXPECTED_SECTIONS.length);
  });

  it.each(EXPECTED_SECTIONS)(
    'should have non-empty plainTitle, intro and reassurance for section %i',
    (section) => {
      const guide = SECTION_GUIDES_06_10.find((g) => g.section === section);
      expect(guide).toBeTruthy();
      expect(guide!.plainTitle.trim().length).toBeGreaterThan(0);
      expect(guide!.intro.trim().length).toBeGreaterThan(0);
      expect(guide!.reassurance.trim().length).toBeGreaterThan(0);
    },
  );

  it.each(EXPECTED_SECTIONS)(
    'should have a non-empty whatYoullNeed list with non-empty entries for section %i',
    (section) => {
      const guide = SECTION_GUIDES_06_10.find((g) => g.section === section);
      expect(guide!.whatYoullNeed.length).toBeGreaterThan(0);
      for (const item of guide!.whatYoullNeed) {
        expect(item.trim().length).toBeGreaterThan(0);
      }
    },
  );

  it('should not mention "Law Society" in any intro (link text lives elsewhere)', () => {
    for (const guide of SECTION_GUIDES_06_10) {
      expect(guide.intro).not.toContain('Law Society');
    }
  });

  it('should keep every intro under 400 characters', () => {
    for (const guide of SECTION_GUIDES_06_10) {
      expect(guide.intro.length).toBeLessThan(400);
    }
  });
});
