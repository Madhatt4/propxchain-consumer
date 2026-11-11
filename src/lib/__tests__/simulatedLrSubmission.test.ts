// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { isSimulatedLrSubmission, simulatedLrNote, SIMULATED_LR_NOTE } from '../simulatedLrSubmission';

describe('simulatedLrNote', () => {
  it('should flag the exact pre-2026-11-11 simulated submission event', () => {
    expect(simulatedLrNote('lr_submission', 'Land Registry submission triggered')).toBe(SIMULATED_LR_NOTE);
    expect(isSimulatedLrSubmission('lr_submission', 'Land Registry submission triggered')).toBe(true);
  });

  it("should not flag the buyer's conveyancer's real application record", () => {
    const real = "Registration application submitted to HM Land Registry by the buyer's conveyancer on 2026-11-12, HMLR application reference TEST/1";
    expect(simulatedLrNote('lr_submission', real)).toBeNull();
  });

  it('should not flag the same text on another event type, or near-miss text', () => {
    expect(simulatedLrNote('blockchain_completed', 'Land Registry submission triggered')).toBeNull();
    expect(simulatedLrNote('lr_submission', 'land registry submission triggered')).toBeNull();
    expect(simulatedLrNote('lr_submission', '')).toBeNull();
  });

  it('should say no application was submitted and no confirmation number exists', () => {
    expect(SIMULATED_LR_NOTE).toMatch(/No application was submitted to HM Land Registry/);
    expect(SIMULATED_LR_NOTE).toMatch(/no confirmation number exists/);
  });
});
