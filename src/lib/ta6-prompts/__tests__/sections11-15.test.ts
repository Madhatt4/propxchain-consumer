import { describe, expect, it } from 'vitest';

import { SECTION_11_PROMPTS } from '../section11';
import { SECTION_12_PROMPTS } from '../section12';
import { SECTION_13_PROMPTS } from '../section13';
import { SECTION_14_PROMPTS } from '../section14';
import { SECTION_15_PROMPTS } from '../section15';
import { TA6_OFFICIAL_FORM_URL, type TA6PromptEntry } from '../types';

const ALL_ENTRIES: TA6PromptEntry[] = [
  ...SECTION_11_PROMPTS,
  ...SECTION_12_PROMPTS,
  ...SECTION_13_PROMPTS,
  ...SECTION_14_PROMPTS,
  ...SECTION_15_PROMPTS,
];

describe('TA6 paraphrase prompts — sections 11 to 15', () => {
  it('should have a unique ref for every entry across sections 11-15', () => {
    // Arrange
    const refs = ALL_ENTRIES.map((entry) => entry.ref);

    // Act
    const uniqueRefs = new Set(refs);

    // Assert
    expect(uniqueRefs.size).toBe(refs.length);
  });

  it('should have a non-empty prompt on every entry', () => {
    // Arrange + Act
    const emptyPrompts = ALL_ENTRIES.filter((entry) => entry.prompt.trim().length === 0);

    // Assert
    expect(emptyPrompts).toEqual([]);
  });

  it('should not contain the exact phrase "Law Society" in any prompt or help text', () => {
    // Arrange + Act
    const leakingEntries = ALL_ENTRIES.filter(
      (entry) =>
        entry.prompt.includes('Law Society') || (entry.helpText ?? '').includes('Law Society'),
    );

    // Assert
    expect(leakingEntries.map((entry) => entry.ref)).toEqual([]);
  });

  it('should carry the official form URL as lawSocietyAnchor on every entry', () => {
    // Arrange + Act
    const missingAnchor = ALL_ENTRIES.filter(
      (entry) => entry.lawSocietyAnchor !== TA6_OFFICIAL_FORM_URL,
    );

    // Assert
    expect(missingAnchor.map((entry) => entry.ref)).toEqual([]);
  });

  it('should expose one prompt per section 12 service row using the synthetic keys', () => {
    // Arrange
    const expectedKeys = [
      '12.electricity',
      '12.gas',
      '12.water',
      '12.sewerage',
      '12.treatment-plant',
      '12.heat-pumps',
      '12.telephone',
      '12.broadband',
      '12.other',
    ];

    // Act
    const actualKeys = SECTION_12_PROMPTS.map((entry) => entry.ref);

    // Assert
    expect(actualKeys.sort()).toEqual([...expectedKeys].sort());
  });

  it('should prefix every ref with the section number of the file it lives in', () => {
    // Arrange
    const sections: ReadonlyArray<[string, TA6PromptEntry[]]> = [
      ['11.', SECTION_11_PROMPTS],
      ['12.', SECTION_12_PROMPTS],
      ['13.', SECTION_13_PROMPTS],
      ['14.', SECTION_14_PROMPTS],
      ['15.', SECTION_15_PROMPTS],
    ];

    // Act
    const misfiled = sections.flatMap(([prefix, entries]) =>
      entries.filter((entry) => !entry.ref.startsWith(prefix)),
    );

    // Assert
    expect(misfiled.map((entry) => entry.ref)).toEqual([]);
  });
});
