// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';

import type { PropertyIntelligenceReport } from '../../../../services/propertyIntelligenceService';
import { buildAskLists, buildClears, buildStandouts } from '../reportFindings';

function report(overrides: Partial<PropertyIntelligenceReport> = {}): PropertyIntelligenceReport {
  return {
    postcode: 'SG18 0AA',
    fetchedAt: 0,
    location: null,
    coordinateSource: null,
    titleBoundary: null,
    flood: { activeWarnings: [], status: 'low' },
    heritage: { listedBuildings: [], conservationAreas: [], status: 'none' },
    article4: { directions: [], status: 'none' },
    treePreservation: { zones: [], status: 'none' },
    floodZone: { zones: [], status: 'none' },
    environmental: { designations: [], status: 'none' },
    brownfield: { sites: [], status: 'none' },
    planningApplications: { applications: [], total: 0, status: 'none' },
    pricePaid: null,
    epc: null,
    surfaceWater: { band: 'very_low', confidence: null },
    coalMining: { inHighRiskArea: false },
    radon: { classMax: 1, description: '', gridSquare: '' },
    coverageGap: null,
    valuePerSqm: null,
    localPlanningAuthority: null,
    sources: [],
    ...overrides,
  };
}

const ca = { entity: 1, name: 'Matlock Bath', dataset: 'conservation-area', reference: '4113', startDate: null, documentUrl: null };

describe('buildStandouts', () => {
  it('should find nothing for a clean report', () => {
    expect(buildStandouts(report())).toEqual([]);
  });

  it('should rank serious hazards, then moderate ones, then constraints', () => {
    const out = buildStandouts(
      report({
        heritage: { listedBuildings: [], conservationAreas: [ca], status: 'in_conservation_area' },
        surfaceWater: { band: 'medium', confidence: 1 },
        radon: { classMax: 6, description: '', gridSquare: 'SK2958' },
      }),
    );

    expect(out.map((s) => [s.key, s.severity])).toEqual([
      ['radon', 'high'],
      ['surface-water', 'medium'],
      ['conservation', 'constraint'],
    ]);
    expect(out[2].title).toBe('In the Matlock Bath conservation area');
  });

  it('should treat an unnumbered flood zone as moderate and zone 3 as serious', () => {
    expect(buildStandouts(report({ floodZone: { zones: [], status: 'zone_present' } }))[0]).toMatchObject({ severity: 'medium', title: 'In a flood risk zone' });
    expect(buildStandouts(report({ floodZone: { zones: [], status: 'zone_3' } }))[0]).toMatchObject({ severity: 'high', title: 'In Flood Zone 3' });
  });

  it('should ignore flood warnings that are no longer in force', () => {
    const warning = { description: '', severity: 'no_longer_in_force' as const, severityLevel: 4 as const, timeRaised: '', area: 'River', sourceUrl: '' };
    expect(buildStandouts(report({ flood: { activeWarnings: [warning], status: 'low' } }))).toEqual([]);
  });

  it('should name a world heritage buffer zone as a buffer zone', () => {
    const whs = { ...ca, name: 'Derwent Valley Mills', dataset: 'world-heritage-site-buffer-zone' };
    const out = buildStandouts(report({ heritage: { listedBuildings: [], conservationAreas: [], worldHeritageSites: [whs], status: 'listed_building' } }));
    expect(out[0].title).toBe('In the buffer zone of Derwent Valley Mills');
    expect(out[0].severity).toBe('constraint');
  });

  it('should leave missing sources out rather than call them clear or flagged', () => {
    const out = buildStandouts(report({ floodZone: null, surfaceWater: null, coalMining: null, radon: null, heritage: null }));
    expect(out).toEqual([]);
    expect(buildClears(report({ floodZone: null, surfaceWater: null, coalMining: null, radon: null }))).not.toContain('flood zone');
  });
});

describe('buildClears', () => {
  it('should list every check that ran and found nothing', () => {
    expect(buildClears(report())).toEqual(['flood zone', 'surface water', 'coal mining', 'radon', 'brownfield', 'heritage', 'Article 4', 'protected trees']);
  });
});

describe('buildAskLists', () => {
  it('should always include the baseline questions', () => {
    const lists = buildAskLists(report());
    expect(lists.seller.map((i) => i.q)).toEqual(['Are there any disputes or complaints with neighbours?']);
    expect(lists.conveyancer[0].q).toMatch(/local authority, drainage and environmental searches/);
    expect(lists.surveyor[0].q).toMatch(/roof, walls and any damp/);
  });

  it('should ask about flooding, a mining search and consents when those apply', () => {
    const lists = buildAskLists(
      report({
        floodZone: { zones: [], status: 'zone_2' },
        coalMining: { inHighRiskArea: true },
        heritage: { listedBuildings: [], conservationAreas: [ca], status: 'in_conservation_area' },
      }),
    );
    expect(lists.seller.map((i) => i.q)).toEqual(
      expect.arrayContaining(['Has the property ever flooded, inside or in the garden?', 'Which alterations have been made, and is there consent for each?']),
    );
    expect(lists.conveyancer.map((i) => i.q)).toContain('Order a CON29M coal mining search.');
    expect(lists.surveyor.map((i) => i.q)).toEqual(expect.arrayContaining([expect.stringMatching(/ground movement/), expect.stringMatching(/like-for-like/)]));
  });

  it('should only ask the surveyor about radon measures from class 3 up', () => {
    expect(buildAskLists(report({ radon: { classMax: 2, description: '', gridSquare: '' } })).surveyor.some((i) => /radon/.test(i.q))).toBe(false);
    expect(buildAskLists(report({ radon: { classMax: 3, description: '', gridSquare: '' } })).surveyor.some((i) => /radon/.test(i.q))).toBe(true);
  });

  it('should raise insulation with the surveyor for a poor energy rating', () => {
    const epc = { address: '', postcode: '', uprn: null, currentBand: 'F' as const, potentialBand: null, currentRating: 30, potentialRating: null, floorAreaSqm: null, lodgementDate: null, meetsMees: false };
    expect(buildAskLists(report({ epc })).surveyor[0].why).toBe('The energy rating is F.');
  });
});
