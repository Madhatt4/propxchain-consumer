// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd
//
// ADR 0009 guardrails for the TA6 paraphrase bundle, sections 1-5: refs must
// be unique, prompts must be present, and no entry may leak Law Society
// verbatim wording (spot-checked via the publisher's name).

import { describe, expect, it } from 'vitest';

import { SECTION_01_PROMPTS } from '../section01';
import { SECTION_02_PROMPTS } from '../section02';
import { SECTION_03_PROMPTS } from '../section03';
import { SECTION_04_PROMPTS } from '../section04';
import { SECTION_05_PROMPTS } from '../section05';
import { TA6_OFFICIAL_FORM_URL } from '../types';

import type { TA6PromptEntry } from '../types';

const SECTIONS: ReadonlyArray<[name: string, entries: TA6PromptEntry[]]> = [
  ['section01', SECTION_01_PROMPTS],
  ['section02', SECTION_02_PROMPTS],
  ['section03', SECTION_03_PROMPTS],
  ['section04', SECTION_04_PROMPTS],
  ['section05', SECTION_05_PROMPTS],
];

const ALL_ENTRIES: TA6PromptEntry[] = SECTIONS.flatMap(([, entries]) => entries);

describe('TA6 paraphrase bundle — sections 1-5', () => {
  it('should have at least one entry per section file', () => {
    // Arrange: section files paired with their names (SECTIONS above)
    // Act + Assert: every file exports a non-empty prompt list
    for (const [name, entries] of SECTIONS) {
      expect(entries.length, `${name} exports no prompts`).toBeGreaterThan(0);
    }
  });

  it('should have a unique ref for every entry across sections 1-5', () => {
    // Arrange
    const refs = ALL_ENTRIES.map((entry) => entry.ref);

    // Act
    const uniqueRefs = new Set(refs);

    // Assert
    const duplicates = refs.filter((ref, index) => refs.indexOf(ref) !== index);
    expect(duplicates, `duplicate refs: ${duplicates.join(', ')}`).toEqual([]);
    expect(uniqueRefs.size).toBe(refs.length);
  });

  it('should have a non-empty ref and prompt for every entry', () => {
    // Arrange + Act + Assert
    for (const entry of ALL_ENTRIES) {
      expect(entry.ref.trim().length, `entry with prompt "${entry.prompt}" has a blank ref`).toBeGreaterThan(0);
      expect(entry.prompt.trim().length, `ref ${entry.ref} has an empty prompt`).toBeGreaterThan(0);
    }
  });

  it('should not contain the exact phrase "Law Society" in any prompt or helpText', () => {
    // Arrange: verbatim-leakage spot-check — paraphrases never name the publisher
    const forbidden = 'Law Society';

    // Act + Assert
    for (const entry of ALL_ENTRIES) {
      expect(entry.prompt, `ref ${entry.ref} prompt leaks "${forbidden}"`).not.toContain(forbidden);
      if (entry.helpText !== undefined) {
        expect(entry.helpText, `ref ${entry.ref} helpText leaks "${forbidden}"`).not.toContain(forbidden);
      }
    }
  });

  it('should set lawSocietyAnchor to the official form URL on every entry', () => {
    // Arrange + Act + Assert
    for (const entry of ALL_ENTRIES) {
      expect(entry.lawSocietyAnchor, `ref ${entry.ref} has no anchor`).toBe(TA6_OFFICIAL_FORM_URL);
    }
  });
});
