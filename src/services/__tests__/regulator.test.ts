// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi } from 'vitest';
import { regulatedLabel, registrationText, regulatorNumber, showsSraFirm } from '../regulator';
import { rowToProvider, type ConveyancerPanelRow } from '../supabaseProviderDataSource';

vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn() } }));

function row(overrides: Partial<ConveyancerPanelRow> = {}): ConveyancerPanelRow {
  return {
    id: 'a', practice_name: 'Alpha', clc_id: '1234567', postcode: 'AB1 2CD', city: 'Town',
    county: null, lat: null, lng: null, services: null, recommended: false,
    rating: null, review_count: null, active_on_panel: true, status: 'Active',
    ...overrides,
  };
}

const HOLDEN_SMITH = row({
  practice_name: 'Holden Smith Law Limited', regulator: 'SRA', sra_number: '654648', clc_id: null,
  city: 'Huddersfield', postcode: 'HD8 8PR',
});

describe('regulatorNumber', () => {
  it('should read a CLC firm by its clc_id', () => {
    expect(regulatorNumber({ regulator: 'CLC', clc_id: '1234567' })).toEqual({ regulator: 'CLC', number: '1234567' });
  });

  it('should read an SRA firm by its sra_number when clc_id is null', () => {
    expect(regulatorNumber({ regulator: 'SRA', clc_id: null, sra_number: '654648' })).toEqual({ regulator: 'SRA', number: '654648' });
  });

  it('should treat a row from before the regulator column as CLC', () => {
    expect(regulatorNumber({ clc_id: '1234567' })).toEqual({ regulator: 'CLC', number: '1234567' });
  });

  it('should return null when the firm has no number for its own regulator', () => {
    expect(regulatorNumber({ regulator: 'SRA', clc_id: '1234567', sra_number: null })).toBeNull();
    expect(regulatorNumber({ regulator: 'CLC', clc_id: null })).toBeNull();
  });
});

describe('regulatedLabel', () => {
  it('should label each firm with its own regulator', () => {
    expect(regulatedLabel({ clc_id: '1234567' })).toBe('CLC #1234567');
    expect(regulatedLabel({ regulator: 'SRA', clc_id: null, sra_number: '654648' })).toBe('SRA #654648');
  });

  it('should never print "null" when a number is missing', () => {
    expect(regulatedLabel({ regulator: 'SRA', clc_id: null, sra_number: null })).toBe('SRA regulated');
    expect(regulatedLabel({ clc_id: null })).toBe('CLC regulated');
  });
});

// The admin pending-conveyancers table and its confirm dialogs read this.
describe('registrationText', () => {
  it('should name each firm by its own regulator', () => {
    expect(registrationText({ clc_id: '1234567' })).toBe('CLC 1234567');
    expect(registrationText({ regulator: 'SRA', clc_id: null, sra_number: '654648' })).toBe('SRA 654648');
  });

  it('should return null rather than "CLC null" when the number is missing', () => {
    expect(registrationText({ clc_id: null })).toBeNull();
    expect(registrationText({ regulator: 'SRA', sra_number: null })).toBeNull();
  });
});

describe('showsSraFirm', () => {
  it('should be true only when an SRA firm is on screen', () => {
    expect(showsSraFirm([{ regulator: 'CLC' }, {}])).toBe(false);
    expect(showsSraFirm([{ regulator: 'CLC' }, { regulator: 'SRA' }])).toBe(true);
    expect(showsSraFirm([])).toBe(false);
  });
});

describe('rowToProvider for an SRA firm', () => {
  it('should show the SRA number, not a CLC one', () => {
    const p = rowToProvider(HOLDEN_SMITH);
    expect(p.regulated).toBe('SRA #654648');
    expect(p.regulator).toBe('SRA');
    expect(p.features[0]).toBe('SRA Regulated');
  });

  it('should keep a CLC firm exactly as before', () => {
    const p = rowToProvider(row());
    expect(p.regulated).toBe('CLC #1234567');
    expect(p.regulator).toBe('CLC');
    expect(p.features[0]).toBe('CLC Licensed');
  });
});
