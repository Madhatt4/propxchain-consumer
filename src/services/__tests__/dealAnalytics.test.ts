import { describe, it, expect } from 'vitest';

import { formatTargetDate } from '../dealAnalytics';
import { overallProgress } from '../phaseChecklistLoader';
import type { PhaseChecklistState } from '../phaseChecklist';

function state(phase: PhaseChecklistState['phase'], progress: number): PhaseChecklistState {
  return { phase, items: [], progress };
}

describe('formatTargetDate', () => {
  it('is null until a completion date is agreed', () => {
    expect(formatTargetDate('')).toBeNull();
    expect(formatTargetDate('   ')).toBeNull();
    expect(formatTargetDate(undefined)).toBeNull();
  });

  it('is null for a value that is not a date, never "Invalid Date"', () => {
    expect(formatTargetDate('TBC')).toBeNull();
  });

  it('formats an agreed date in UK order', () => {
    expect(formatTargetDate('2026-11-20')).toBe('20/11/2026');
  });
});

describe('overallProgress', () => {
  it('starts at zero on a fresh listing', () => {
    expect(overallProgress(state('sellerPrep', 0))).toBe(0);
  });

  it('counts each earlier phase as a full step plus the current checklist share', () => {
    // searches is the third of five steps: 2 full steps + half of this one.
    expect(overallProgress(state('searches', 0.5))).toBeCloseTo(0.5);
  });

  it('is complete once the deal has completed', () => {
    expect(overallProgress(state('completed', 0))).toBe(1);
  });
});
