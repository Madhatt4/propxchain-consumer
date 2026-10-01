// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { COMMON_SECTIONS, portalKindsFor, sectionsFor } from '../portalSections';

const labels = (sections: ReadonlyArray<{ label: string }>): string[] => sections.map((s) => s.label);

describe('portalKindsFor', () => {
  it('should give a plain seller or buyer no professional extras', () => {
    expect(portalKindsFor([], 'seller')).toEqual([]);
    expect(portalKindsFor(['consumer'], 'buyer')).toEqual([]);
  });

  it('should read an agent from their organisation', () => {
    expect(portalKindsFor(['agent'])).toEqual(['agent']);
  });

  it('should read a professional from the sign-up role before an organisation exists', () => {
    expect(portalKindsFor([], 'agent')).toEqual(['agent']);
    expect(portalKindsFor([], 'developer')).toEqual(['developer']);
    expect(portalKindsFor([], 'solicitor')).toEqual(['conveyancer']);
  });

  it('should treat a solicitor firm as a conveyancer', () => {
    expect(portalKindsFor(['solicitor_firm'])).toEqual(['conveyancer']);
  });

  it('should not repeat a kind held both ways, and keep a fixed order', () => {
    expect(portalKindsFor(['developer', 'agent'], 'agent')).toEqual(['agent', 'developer']);
  });
});

describe('sectionsFor', () => {
  it('should give everyone the same common sections first', () => {
    expect(labels(sectionsFor([]))).toEqual(labels(COMMON_SECTIONS));
    expect(labels(sectionsFor(['agent'])).slice(0, COMMON_SECTIONS.length)).toEqual(labels(COMMON_SECTIONS));
  });

  it('should add Listings and Pipeline for an agent', () => {
    expect(labels(sectionsFor(['agent'])).slice(COMMON_SECTIONS.length)).toEqual(['Listings', 'Pipeline']);
  });

  it('should add Sites for a developer', () => {
    expect(labels(sectionsFor(['developer'])).slice(COMMON_SECTIONS.length)).toEqual(['Sites']);
  });

  it('should add nothing beyond the common sections for a conveyancer', () => {
    expect(labels(sectionsFor(['conveyancer'])).slice(COMMON_SECTIONS.length)).toEqual([]);
  });

  it('should link each extra to its existing page', () => {
    const byLabel = Object.fromEntries(sectionsFor(['agent', 'developer', 'conveyancer']).map((s) => [s.label, s.to]));
    expect(byLabel).toMatchObject({
      Listings: '/estate-agent/listings',
      Pipeline: '/estate-agent/pipeline',
      Sites: '/builder',
    });
  });
});
