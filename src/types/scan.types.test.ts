// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import {
  normalizeHmlrToContract,
  type HmlrScanResult,
} from './scan.types';

const baseHmlr: HmlrScanResult = {
  titleNumber: 'GR506405',
  editionDate: '2025-11-02',
  scannedAt: '2026-07-18T10:00:00Z',
  model: 'claude-sonnet-4-6',
  schemaVersion: 1,
  enrichment: {
    classOfTitle: 'Absolute',
    tenure: 'Freehold',
    chargesCount: 1,
    hasRestrictions: true,
    leaseCount: 0,
  },
  findings: [
    { category: 'restriction', severity: 'action', title: 'Restriction on disposition', detail: 'A restriction requires consent before sale.' },
    { category: 'charge', severity: 'attention', title: 'Registered charge', detail: 'A mortgage is registered.' },
    { category: 'tenure', severity: 'info', title: 'Freehold', detail: 'The property is freehold.' },
  ],
  sellerSummary: 'Your title is freehold with a mortgage and a consent restriction.',
  headlineFlags: ['Consent restriction — conveyancer to review'],
};

describe('normalizeHmlrToContract', () => {
  it('should set scan_type hmlr and a pointer-style source_ref', () => {
    const result = normalizeHmlrToContract(baseHmlr);
    expect(result.scan_type).toBe('hmlr');
    expect(result.source_ref).toBe('hmlr:GR506405@2025-11-02');
  });

  it('should map category→key, title→label, detail→value', () => {
    const [first] = normalizeHmlrToContract(baseHmlr).findings;
    expect(first.key).toBe('restriction');
    expect(first.label).toBe('Restriction on disposition');
    expect(first.value).toBe('A restriction requires consent before sale.');
  });

  it('should map severity→confidence and retain the severity badge', () => {
    const [action, attention, info] = normalizeHmlrToContract(baseHmlr).findings;
    expect(action.confidence).toBe('high');
    expect(action.severity).toBe('action');
    expect(attention.confidence).toBe('medium');
    expect(info.confidence).toBe('low');
  });

  it('should mark every HMLR finding as non-personal-data', () => {
    const result = normalizeHmlrToContract(baseHmlr);
    expect(result.findings.every((f) => f.personal_data === false)).toBe(true);
  });

  it('should map sellerSummary→explainer and headlineFlags→flags_for_conveyancer', () => {
    const result = normalizeHmlrToContract(baseHmlr);
    expect(result.explainer).toBe(baseHmlr.sellerSummary);
    expect(result.flags_for_conveyancer).toEqual(baseHmlr.headlineFlags);
  });

  it('should set provenance to the HMLR title register with the title number', () => {
    const [first] = normalizeHmlrToContract(baseHmlr).findings;
    expect(first.provenance).toContain('GR506405');
  });

  it('should handle an empty findings/flags register', () => {
    const result = normalizeHmlrToContract({ ...baseHmlr, findings: [], headlineFlags: [] });
    expect(result.findings).toEqual([]);
    expect(result.flags_for_conveyancer).toEqual([]);
  });
});
