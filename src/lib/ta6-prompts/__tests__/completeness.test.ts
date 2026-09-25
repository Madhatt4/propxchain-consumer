import { describe, it, expect } from 'vitest';

import { SECTION_01_PROMPTS } from '../section01';
import { SECTION_02_PROMPTS } from '../section02';
import { SECTION_03_PROMPTS } from '../section03';
import { SECTION_04_PROMPTS } from '../section04';
import { SECTION_05_PROMPTS } from '../section05';
import { SECTION_06_PROMPTS } from '../section06';
import { SECTION_07_PROMPTS } from '../section07';
import { SECTION_08_PROMPTS } from '../section08';
import { SECTION_09_PROMPTS } from '../section09';
import { SECTION_10_PROMPTS } from '../section10';
import { SECTION_11_PROMPTS } from '../section11';
import { SECTION_12_PROMPTS } from '../section12';
import { SECTION_13_PROMPTS } from '../section13';
import { SECTION_14_PROMPTS } from '../section14';
import { SECTION_15_PROMPTS } from '../section15';
import { ALL_TA6_PROMPTS, getPrompt } from '../index';
import type { TA6PromptEntry } from '../types';

const SECTIONS: ReadonlyArray<readonly [string, readonly TA6PromptEntry[]]> = [
  ['section01', SECTION_01_PROMPTS],
  ['section02', SECTION_02_PROMPTS],
  ['section03', SECTION_03_PROMPTS],
  ['section04', SECTION_04_PROMPTS],
  ['section05', SECTION_05_PROMPTS],
  ['section06', SECTION_06_PROMPTS],
  ['section07', SECTION_07_PROMPTS],
  ['section08', SECTION_08_PROMPTS],
  ['section09', SECTION_09_PROMPTS],
  ['section10', SECTION_10_PROMPTS],
  ['section11', SECTION_11_PROMPTS],
  ['section12', SECTION_12_PROMPTS],
  ['section13', SECTION_13_PROMPTS],
  ['section14', SECTION_14_PROMPTS],
  ['section15', SECTION_15_PROMPTS],
];

describe('TA6 prompt bundle completeness', () => {
  it.each(SECTIONS)('should expose a non-empty prompt array for %s', (_name, prompts) => {
    // Arrange / Act / Assert — every section must contribute at least one prompt
    expect(prompts.length).toBeGreaterThan(0);
  });

  it('should give every prompt a globally unique ref across all sections', () => {
    // Arrange
    const refs = SECTIONS.flatMap(([, prompts]) => prompts.map((entry) => entry.ref));
    // Act
    const unique = new Set(refs);
    // Assert
    expect(unique.size).toBe(refs.length);
  });

  it('should assemble every section entry into ALL_TA6_PROMPTS', () => {
    // Arrange
    const total = SECTIONS.reduce((sum, [, prompts]) => sum + prompts.length, 0);
    // Act / Assert
    expect(ALL_TA6_PROMPTS.size).toBe(total);
  });

  it('should resolve a known ref and return undefined for an unknown ref', () => {
    // Act / Assert
    expect(getPrompt('8.1')).toBeDefined();
    expect(getPrompt('does.not.exist')).toBeUndefined();
  });
});
