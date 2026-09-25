import { SECTION_GUIDES_01_05 } from './sections01to05';
import { SECTION_GUIDES_06_10 } from './sections06to10';
import { SECTION_GUIDES_11_15 } from './sections11to15';
import type { TA6SectionGuide } from './types';

export type { TA6SectionGuide } from './types';

const ALL_GUIDES: readonly TA6SectionGuide[] = [
  ...SECTION_GUIDES_01_05,
  ...SECTION_GUIDES_06_10,
  ...SECTION_GUIDES_11_15,
];

const BY_SECTION = new Map<number, TA6SectionGuide>(ALL_GUIDES.map((g) => [g.section, g]));

export function getSectionGuide(section: number): TA6SectionGuide | undefined {
  return BY_SECTION.get(section);
}
