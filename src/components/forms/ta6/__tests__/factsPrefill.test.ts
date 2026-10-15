// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';

import { prefillTa6FromFacts, SUGGESTED_EICR, SUGGESTED_WINDOWS } from '../factsPrefill';
import { emptyTA6Form } from '../../../../types/ta6.types';
import type { CurrentFact } from '../../../../services/documentFacts.service';
import type { TA6PropertyInformation } from '../../../../types/ta6.types';

const EDITED = '2026-10-15T10:00:00.000Z';
const AFTER = '2026-10-15T11:00:00.000Z';
const BEFORE = '2026-10-15T09:00:00.000Z';

function fact(factKey: string, overrides: Partial<CurrentFact> = {}): CurrentFact {
  return {
    factKey,
    value: 'true',
    method: 'jev',
    status: 'confirmed',
    storagePath: 'transactions/tx/ta6/abc.jpg',
    checkedAt: AFTER,
    decidedAt: AFTER,
    ...overrides,
  };
}

function form(overrides: (f: TA6PropertyInformation) => TA6PropertyInformation = (f) => f): TA6PropertyInformation {
  return overrides({ ...emptyTA6Form(), lastModifiedAt: EDITED });
}

describe('prefillTa6FromFacts', () => {
  it('should answer a blank 11.3 Yes from a confirmed EICR fact', () => {
    const result = prefillTa6FromFacts(form(), [fact('eicr.satisfactory')]);

    expect(result.form.section11.q11_3Eicr).toBe('yes');
    expect(result.suggested).toEqual([SUGGESTED_EICR]);
  });

  it('should never change an 11.3 the seller already answered', () => {
    const answered = form((f) => ({ ...f, section11: { ...f.section11, q11_3Eicr: 'no' } }));

    const result = prefillTa6FromFacts(answered, [fact('eicr.in_date')]);

    expect(result.form.section11.q11_3Eicr).toBe('no');
    expect(result.suggested).toEqual([]);
  });

  it('should tick replacement windows from a confirmed FENSA certificate when 5.1 is untouched', () => {
    const result = prefillTa6FromFacts(form(), [fact('fensa.present')]);

    expect(result.form.section5.q5_1Alterations.windowsPost2002).toBe(true);
    expect(result.suggested).toEqual([SUGGESTED_WINDOWS]);
  });

  it('should leave 5.1 alone once the seller has ticked anything there', () => {
    const touched = form((f) => ({
      ...f,
      section5: { ...f.section5, q5_1Alterations: { ...f.section5.q5_1Alterations, extension: true } },
    }));

    const result = prefillTa6FromFacts(touched, [fact('fensa.present')]);

    expect(result.form.section5.q5_1Alterations.windowsPost2002).toBe(false);
    expect(result.suggested).toEqual([]);
  });

  it('should ignore a fact confirmed before the seller last edited the form, so an untick sticks', () => {
    const result = prefillTa6FromFacts(form(), [fact('eicr.in_date', { decidedAt: BEFORE })]);

    expect(result.form.section11.q11_3Eicr).toBe('not-answered');
  });

  it('should ignore suggestions the seller has not confirmed, and gas and EPC facts entirely', () => {
    const result = prefillTa6FromFacts(form(), [
      fact('eicr.in_date', { status: 'suggested', decidedAt: null }),
      fact('gas_safety.passed'),
      fact('epc.band', { value: 'C' }),
    ]);

    expect(result.suggested).toEqual([]);
    expect(result.form).toEqual(form());
  });
});
