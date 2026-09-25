import { describe, it, expect } from 'vitest';

import {
  crossReferenceTA6,
  crossReferenceTA7,
  crossReferenceAll,
  type CrossReferenceResult,
} from '../formCrossReferenceService';
import { emptyTA6Form } from '../../types/ta6.types';
import type { TA6PropertyInformation } from '../../types/ta6.types';
import { emptyTA7Form } from '../../types/ta7.types';
import type {
  PropertyIntelligenceReport,
  PlanningEntity,
  PlanningApplication,
} from '../propertyIntelligenceService';

function baseReport(overrides: Partial<PropertyIntelligenceReport> = {}): PropertyIntelligenceReport {
  return {
    postcode: 'SG18 0AA',
    fetchedAt: 1,
    coordinateSource: 'postcode-centroid',
    titleBoundary: null,
    location: {
      postcode: 'SG18 0AA',
      coordinates: { lat: 52.087, lng: -0.275 },
      admin_district: 'Central Bedfordshire',
      admin_ward: 'Biggleswade North',
      country: 'England',
      region: 'East of England',
    },
    flood: { activeWarnings: [], status: 'low' },
    heritage: { listedBuildings: [], conservationAreas: [], status: 'none' },
    article4: { directions: [], status: 'none' },
    treePreservation: { zones: [], status: 'none' },
    floodZone: { zones: [], status: 'none' },
    environmental: { designations: [], status: 'none' },
    brownfield: { sites: [], status: 'none' },
    planningApplications: { applications: [], total: 0, status: 'none' },
    pricePaid: { sales: [], averagePrice: null, latestSale: null },
    epc: null,
    valuePerSqm: null,
    localPlanningAuthority: null,
    sources: [],
    ...overrides,
  };
}

function entity(overrides: Partial<PlanningEntity> = {}): PlanningEntity {
  return {
    entity: 1,
    name: 'Thing',
    dataset: 'listed-building',
    reference: 'LB-1',
    startDate: null,
    documentUrl: null,
    ...overrides,
  };
}

function app(overrides: Partial<PlanningApplication> = {}): PlanningApplication {
  return {
    uid: 'x',
    reference: 'REF',
    description: 'Thing',
    appState: 'Approved',
    address: 'Addr',
    startDate: null,
    decidedDate: null,
    distanceM: 100,
    url: 'https://example.gov.uk',
    ...overrides,
  };
}

function futureDate(yearsFromNow: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + yearsFromNow);
  return d.toISOString().slice(0, 10);
}

function find(results: CrossReferenceResult[], field: string): CrossReferenceResult | undefined {
  return results.find((r) => r.formField === field);
}

// §8.1 answered "no" — an explicit denial that the property has ever flooded.
function withNeverFlooded(): TA6PropertyInformation {
  const form = emptyTA6Form();
  form.section8 = { ...form.section8, q8_1Flooded: { answer: 'no', details: '' } };
  return form;
}

// §5 engaged (a yes/no question answered) but no §5.1 alteration types ticked.
function withEngagedNoAlterations(): TA6PropertyInformation {
  const form = emptyTA6Form();
  form.section5 = { ...form.section5, q5_4Breaches: { answer: 'no', details: '' } };
  return form;
}

describe('crossReferenceTA6', () => {
  it('returns empty array when form or report is null', () => {
    expect(crossReferenceTA6(null, baseReport())).toEqual([]);
    expect(crossReferenceTA6(emptyTA6Form(), null)).toEqual([]);
  });

  it('returns empty when the form is blank and the intel is clean', () => {
    expect(crossReferenceTA6(emptyTA6Form(), baseReport())).toEqual([]);
  });

  describe('flood history contradiction', () => {
    it('flags critical when §8.1 declares never flooded but report shows Flood Zone 3', () => {
      const form = withNeverFlooded();
      const report = baseReport({
        floodZone: {
          zones: [entity({ dataset: 'flood-risk-zone', name: 'Flood Zone 3' })],
          status: 'zone_3',
        },
      });
      const flag = find(crossReferenceTA6(form, report), 'section8.q8_1Flooded');
      expect(flag).toBeDefined();
      expect(flag?.severity).toBe('critical');
      expect(flag?.conflictType).toBe('contradiction');
      expect(flag?.message).toMatch(/Flood Zone 3/);
    });

    it('does not flag when the seller has declared flooding', () => {
      const form = emptyTA6Form();
      form.section8 = { ...form.section8, q8_1Flooded: { answer: 'yes', details: 'River 2019' } };
      const report = baseReport({
        floodZone: { zones: [entity({ name: 'Flood Zone 2' })], status: 'zone_2' },
      });
      expect(find(crossReferenceTA6(form, report), 'section8.q8_1Flooded')).toBeUndefined();
    });

    it('does not flag when §8.1 is unanswered (draft, no explicit denial)', () => {
      const report = baseReport({
        floodZone: { zones: [entity({ name: 'Flood Zone 3' })], status: 'zone_3' },
      });
      expect(find(crossReferenceTA6(emptyTA6Form(), report), 'section8.q8_1Flooded')).toBeUndefined();
    });
  });

  it('emits a warning-level info flag when the EA reports an active flood warning nearby', () => {
    const report = baseReport({
      flood: {
        status: 'high',
        activeWarnings: [
          {
            description: 'River flooding',
            severity: 'warning',
            severityLevel: 2,
            timeRaised: '2026-04-19T09:00:00Z',
            area: 'Thames',
            sourceUrl: 'https://example.gov.uk',
          },
        ],
      },
    });
    const flag = find(crossReferenceTA6(emptyTA6Form(), report), 'flood');
    expect(flag?.severity).toBe('warning');
    expect(flag?.message).toMatch(/1 active flood warning/);
  });

  it('flags "no alterations" with nearby approved planning records', () => {
    const report = baseReport({
      planningApplications: {
        applications: [app({ appState: 'Approved' })],
        total: 1,
        status: 'some',
      },
    });
    const flag = find(crossReferenceTA6(withEngagedNoAlterations(), report), 'section5.q5_1Alterations');
    expect(flag?.severity).toBe('warning');
    expect(flag?.conflictType).toBe('contradiction');
  });

  it('does not flag "no alterations" when §5 is still untouched', () => {
    const report = baseReport({
      planningApplications: {
        applications: [app({ appState: 'Approved' })],
        total: 1,
        status: 'some',
      },
    });
    expect(
      find(crossReferenceTA6(emptyTA6Form(), report), 'section5.q5_1Alterations'),
    ).toBeUndefined();
  });

  it('emits info flag for conservation area on the §5 alterations section', () => {
    const report = baseReport({
      heritage: {
        listedBuildings: [],
        conservationAreas: [entity({ dataset: 'conservation-area', name: 'Old Town' })],
        status: 'in_conservation_area',
      },
    });
    const flag = find(crossReferenceTA6(emptyTA6Form(), report), 'section5.q5_8ConservationArea');
    expect(flag?.severity).toBe('info');
    expect(flag?.message).toMatch(/conservation area/);
  });

  it('emits info flag for listed building on the §5 alterations section', () => {
    const report = baseReport({
      heritage: {
        listedBuildings: [entity({ dataset: 'listed-building', name: 'The Manor' })],
        conservationAreas: [],
        status: 'listed_building',
      },
    });
    const flag = find(crossReferenceTA6(emptyTA6Form(), report), 'section5.q5_7ListedBuilding');
    expect(flag?.severity).toBe('info');
    expect(flag?.formSection).toBe('TA6 §5 Alterations, planning and building control');
  });

  it('emits info flag for environmental designation with a pretty label', () => {
    const report = baseReport({
      environmental: {
        designations: [
          entity({ dataset: 'area-of-outstanding-natural-beauty', name: 'Chilterns AONB' }),
        ],
        status: 'single',
      },
    });
    const flag = find(crossReferenceTA6(emptyTA6Form(), report), 'section8');
    expect(flag?.severity).toBe('info');
    expect(flag?.message).toMatch(/an AONB/);
  });
});

describe('crossReferenceTA7', () => {
  it('returns empty when form is null', () => {
    expect(crossReferenceTA7(null, baseReport())).toEqual([]);
  });

  it('flags critical when lease has under 80 years remaining', () => {
    const form = {
      ...emptyTA7Form,
      leaseExpiryDate: futureDate(50),
      leaseTermYears: 99,
    };
    const flag = find(crossReferenceTA7(form, null), 'leaseExpiryDate');
    expect(flag?.severity).toBe('critical');
    expect(flag?.message).toMatch(/below the 80-year mortgage threshold/);
  });

  it('does not flag lease when 80+ years remain', () => {
    const form = {
      ...emptyTA7Form,
      leaseExpiryDate: futureDate(120),
      leaseTermYears: 125,
    };
    expect(find(crossReferenceTA7(form, null), 'leaseExpiryDate')).toBeUndefined();
  });

  it('flags warning when ground rent exceeds £250', () => {
    const form = {
      ...emptyTA7Form,
      groundRentAmount: 300,
      groundRentPaymentFrequency: 'annual' as const,
    };
    const flag = find(crossReferenceTA7(form, null), 'groundRentAmount');
    expect(flag?.severity).toBe('warning');
    expect(flag?.message).toMatch(/onerous/);
  });

  it('does not flag ground rent at or under £250', () => {
    const form = { ...emptyTA7Form, groundRentAmount: 250 };
    expect(find(crossReferenceTA7(form, null), 'groundRentAmount')).toBeUndefined();
  });
});

describe('crossReferenceAll', () => {
  it('concatenates TA6 and TA7 flags and sorts critical > warning > info', () => {
    const ta6 = withEngagedNoAlterations();
    const ta7 = {
      ...emptyTA7Form,
      leaseExpiryDate: futureDate(50),
      groundRentAmount: 400,
    };
    const report = baseReport({
      heritage: {
        listedBuildings: [],
        conservationAreas: [entity({ dataset: 'conservation-area', name: 'Old Town' })],
        status: 'in_conservation_area',
      },
      planningApplications: {
        applications: [app({ appState: 'Approved' })],
        total: 1,
        status: 'some',
      },
    });
    const results = crossReferenceAll(ta6, ta7, report);
    expect(results.length).toBeGreaterThanOrEqual(4);
    expect(results[0].severity).toBe('critical');
    // critical, warning(s), info(s) — severity must be non-decreasing
    const ranks = results.map((r) => ({ critical: 0, warning: 1, info: 2 }[r.severity]));
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]).toBeGreaterThanOrEqual(ranks[i - 1]);
    }
  });

  it('returns empty array when both forms are null', () => {
    expect(crossReferenceAll(null, null, baseReport())).toEqual([]);
  });
});
