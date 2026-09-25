// Assembled TA6 6th-edition paraphrase bundle. The 15 per-section prompt
// arrays (section01..section15) are flattened into a single ref -> entry map so
// any component can resolve a prompt by its question ref without knowing which
// section owns it. Every ref is globally unique (asserted in
// __tests__/completeness.test.ts).

import { SECTION_01_PROMPTS } from './section01';
import { SECTION_02_PROMPTS } from './section02';
import { SECTION_03_PROMPTS } from './section03';
import { SECTION_04_PROMPTS } from './section04';
import { SECTION_05_PROMPTS } from './section05';
import { SECTION_06_PROMPTS } from './section06';
import { SECTION_07_PROMPTS } from './section07';
import { SECTION_08_PROMPTS } from './section08';
import { SECTION_09_PROMPTS } from './section09';
import { SECTION_10_PROMPTS } from './section10';
import { SECTION_11_PROMPTS } from './section11';
import { SECTION_12_PROMPTS } from './section12';
import { SECTION_13_PROMPTS } from './section13';
import { SECTION_14_PROMPTS } from './section14';
import { SECTION_15_PROMPTS } from './section15';

import type { TA6PromptEntry } from './types';

// Section arrays in form order (index 0 = §1). Exported so tooling and tests
// can iterate per-section without re-importing each file.
export const TA6_PROMPT_SECTIONS: ReadonlyArray<readonly TA6PromptEntry[]> = [
  SECTION_01_PROMPTS,
  SECTION_02_PROMPTS,
  SECTION_03_PROMPTS,
  SECTION_04_PROMPTS,
  SECTION_05_PROMPTS,
  SECTION_06_PROMPTS,
  SECTION_07_PROMPTS,
  SECTION_08_PROMPTS,
  SECTION_09_PROMPTS,
  SECTION_10_PROMPTS,
  SECTION_11_PROMPTS,
  SECTION_12_PROMPTS,
  SECTION_13_PROMPTS,
  SECTION_14_PROMPTS,
  SECTION_15_PROMPTS,
];

export const ALL_TA6_PROMPTS: Map<string, TA6PromptEntry> = new Map(
  TA6_PROMPT_SECTIONS.flatMap((section) => section).map((entry) => [entry.ref, entry]),
);

/** Resolve a paraphrase prompt by its question ref (e.g. "8.1", "1.postcode"). */
export function getPrompt(ref: string): TA6PromptEntry | undefined {
  return ALL_TA6_PROMPTS.get(ref);
}

export { TA6_OFFICIAL_FORM_URL } from './types';
export type { TA6PromptEntry } from './types';
