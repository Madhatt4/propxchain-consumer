import { describe, expect, it } from 'vitest';

import { buildNextSteps } from '../homeMoverNextSteps';
import type { PropertyIntelligenceReport } from '../../../services/propertyIntelligenceService';

const DISCLAIMER = /your official searches remain the authoritative record/;

/** A report where every check raises a flag, so there are more flags than room. */
function everyFlagReport(): PropertyIntelligenceReport {
  return {
    coverageGap: 'Wales',
    article4: { status: 'restricted' },
    floodZone: { status: 'zone3' },
    surfaceWater: { band: 'high' },
    coalMining: { inHighRiskArea: true },
    heritage: { status: 'both' },
    treePreservation: { status: 'present' },
    radon: { classMax: 4 },
    brownfield: { status: 'present' },
    planningApplications: { status: 'many' },
  } as unknown as PropertyIntelligenceReport;
}

describe('buildNextSteps', () => {
  it('should keep the official-searches line last when more flags fire than fit', () => {
    const steps = buildNextSteps(everyFlagReport());

    expect(steps).toHaveLength(5);
    expect(steps[4]).toMatch(DISCLAIMER);
    expect(steps.filter((s) => DISCLAIMER.test(s))).toHaveLength(1);
  });

  it('should show the no-flags step and the official-searches line for a clear report', () => {
    const steps = buildNextSteps({} as PropertyIntelligenceReport);

    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatch(/No major flags/);
    expect(steps[1]).toMatch(DISCLAIMER);
  });
});
