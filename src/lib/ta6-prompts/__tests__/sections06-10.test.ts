// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd
//
// TA6 paraphrase bundle — sections 6-10 (ADR 0009).
// Guards the licensing boundary: refs unique, prompts populated, no verbatim
// Law-Society-wording leakage marker, every entry linked to the official form.

import { describe, it, expect } from 'vitest';

import { SECTION_06_PROMPTS } from '../section06';
import { SECTION_07_PROMPTS } from '../section07';
import { SECTION_08_PROMPTS } from '../section08';
import { SECTION_09_PROMPTS } from '../section09';
import { SECTION_10_PROMPTS } from '../section10';
import type { TA6PromptEntry } from '../types';

const SECTIONS: ReadonlyArray<{ name: string; prompts: TA6PromptEntry[] }> = [
  { name: 'section06', prompts: SECTION_06_PROMPTS },
  { name: 'section07', prompts: SECTION_07_PROMPTS },
  { name: 'section08', prompts: SECTION_08_PROMPTS },
  { name: 'section09', prompts: SECTION_09_PROMPTS },
  { name: 'section10', prompts: SECTION_10_PROMPTS },
];

describe('TA6 paraphrase bundle — sections 6-10', () => {
  it('should have no duplicate refs across sections 6-10', () => {
    // Arrange
    const allRefs = SECTIONS.flatMap((s) => s.prompts.map((p) => p.ref));

    // Act
    const uniqueRefs = new Set(allRefs);

    // Assert
    expect(uniqueRefs.size).toBe(allRefs.length);
  });

  it.each(SECTIONS)('should have a non-empty array of prompts in $name', ({ prompts }) => {
    // Arrange / Act / Assert
    expect(prompts.length).toBeGreaterThan(0);
  });

  it.each(SECTIONS)('should have a non-empty prompt for every entry in $name', ({ prompts }) => {
    // Arrange / Act
    const emptyPrompts = prompts.filter((p) => p.prompt.trim().length === 0);

    // Assert
    expect(emptyPrompts).toEqual([]);
  });

  it.each(SECTIONS)(
    'should not contain the exact phrase "Law Society" in any prompt or helpText in $name (verbatim-leakage spot check)',
    ({ prompts }) => {
      // Arrange
      const marker = 'Law Society';

      // Act
      const leaking = prompts.filter(
        (p) => p.prompt.includes(marker) || (p.helpText !== undefined && p.helpText.includes(marker)),
      );

      // Assert
      expect(leaking).toEqual([]);
    },
  );

  it.each(SECTIONS)('should have a non-empty lawSocietyAnchor on every entry in $name', ({ prompts }) => {
    // Arrange / Act
    const missingAnchor = prompts.filter((p) => p.lawSocietyAnchor.trim().length === 0);

    // Assert
    expect(missingAnchor).toEqual([]);
  });

  it.each(SECTIONS)('should prefix every ref with its own section number in $name', ({ name, prompts }) => {
    // Arrange
    const sectionNumber = String(parseInt(name.replace('section', ''), 10));

    // Act
    const wrongSection = prompts.filter((p) => !p.ref.startsWith(`${sectionNumber}.`));

    // Assert
    expect(wrongSection).toEqual([]);
  });
});
