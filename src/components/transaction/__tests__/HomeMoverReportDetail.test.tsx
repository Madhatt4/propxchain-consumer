import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { DetailPages } from '../HomeMoverReportDetail';
import { MAX_ENTITIES } from '../homeMoverReportFormat';
import type {
  PlanningEntity,
  PropertyIntelligenceReport,
} from '../../../services/propertyIntelligenceService';

function entity(n: number, extra: Partial<PlanningEntity> = {}): PlanningEntity {
  return {
    entity: n,
    name: `Entity ${n}`,
    dataset: 'conservation-area',
    reference: `REF-${n}`,
    startDate: null,
    documentUrl: null,
    ...extra,
  };
}

/** A report with something to say in every panel the detail pages render. */
function makeReport(overrides: Partial<PropertyIntelligenceReport> = {}): PropertyIntelligenceReport {
  return {
    postcode: 'SG18 0AA',
    fetchedAt: Date.parse('2026-09-03'),
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
    flood: {
      activeWarnings: [
        {
          description: 'River levels are rising after heavy rain.',
          severity: 'warning',
          severityLevel: 2,
          timeRaised: '2026-09-01T08:00:00Z',
          area: 'River Ivel at Biggleswade',
          sourceUrl: 'https://example.invalid/warning',
        },
      ],
      status: 'medium',
    },
    heritage: {
      listedBuildings: [entity(1, { name: 'The Old Town Hall', dataset: 'listed-building', grade: 'II' })],
      conservationAreas: [],
      status: 'listed_building',
    },
    article4: { directions: [entity(2, { name: 'Article 4 Direction 2019', dataset: 'article-4-direction-area', detail: 'Removes PD rights for HMOs.' })], status: 'restricted' },
    treePreservation: { zones: [], status: 'none' },
    floodZone: { zones: [], status: 'none' },
    environmental: { designations: [entity(3, { name: 'Ivel Valley', dataset: 'green-belt' })], status: 'single' },
    brownfield: { sites: [], status: 'none' },
    planningApplications: {
      applications: [
        {
          uid: 'u1',
          reference: 'CB/26/01234/FULL',
          description: 'Two-storey side extension and loft conversion with rear dormer',
          appState: 'Permitted',
          address: '14 High Street',
          startDate: '2026-07-01',
          decidedDate: null,
          distanceM: 42,
          url: 'https://example.invalid/app',
        },
      ],
      total: 1,
      status: 'some',
    },
    pricePaid: {
      sales: [{ amount: 425000, date: '2025-11-02', paon: '12', street: 'High Street', propertyType: 'terraced' }],
      averagePrice: 425000,
      latestSale: { amount: 425000, date: '2025-11-02', paon: '12', street: 'High Street', propertyType: 'terraced' },
    },
    epc: {
      address: '12 High Street', postcode: 'SG18 0AA', uprn: null,
      currentBand: 'D', potentialBand: 'B', currentRating: 60, potentialRating: 82,
      floorAreaSqm: 85, lodgementDate: '2024-01-01', meetsMees: true,
    },
    valuePerSqm: 5000,
    localPlanningAuthority: null,
    sources: [{ source: 'postcodes.io', ok: true, lastFetched: Date.now() }],
    ...overrides,
  };
}

const PLACE = '12, Central Bedfordshire, SG18 0AA';

describe('DetailPages', () => {
  it('should open with a detail header that repeats the place line', () => {
    render(<DetailPages report={makeReport()} placeLine={PLACE} />);
    expect(screen.getByText(PLACE)).toBeInTheDocument();
    expect(screen.getByText('Home Mover Report — detail')).toBeInTheDocument();
  });

  it('should list live flood warnings with area, severity and description', () => {
    render(<DetailPages report={makeReport()} placeLine={PLACE} />);
    expect(screen.getByText('River Ivel at Biggleswade')).toBeInTheDocument();
    expect(screen.getByText(/Severity 2 · warning · raised/)).toBeInTheDocument();
    expect(screen.getByText('River levels are rising after heavy rain.')).toBeInTheDocument();
  });

  it('should list listed buildings under a counted heading with their grade', () => {
    render(<DetailPages report={makeReport()} placeLine={PLACE} />);
    expect(screen.getByText('Listed building (1)')).toBeInTheDocument();
    expect(screen.getByText(/The Old Town Hall/)).toBeInTheDocument();
    expect(screen.getByText(/Grade II/)).toBeInTheDocument();
  });

  it('should list planning applications with reference, state, description and distance', () => {
    render(<DetailPages report={makeReport()} placeLine={PLACE} />);
    expect(screen.getByText('Showing 1 of 1 applications, most recent first.')).toBeInTheDocument();
    expect(screen.getByText(/CB\/26\/01234\/FULL/)).toBeInTheDocument();
    expect(screen.getByText('Permitted')).toBeInTheDocument();
    expect(screen.getByText(/Two-storey side extension/)).toBeInTheDocument();
    expect(screen.getByText('42m away · raised 2026-07-01')).toBeInTheDocument();
  });

  it('should show EPC bands with ratings, floor area, MEES status and lodgement date', () => {
    render(<DetailPages report={makeReport()} placeLine={PLACE} />);
    expect(screen.getByText('Band D · 60')).toBeInTheDocument();
    expect(screen.getByText('Band B · 82')).toBeInTheDocument();
    expect(screen.getByText('85 m²')).toBeInTheDocument();
    expect(screen.getByText(/Meets MEES \(band E\+\) · Lodged 2024-01-01/)).toBeInTheDocument();
  });

  it('should label environmental designations with the dataset name', () => {
    render(<DetailPages report={makeReport()} placeLine={PLACE} />);
    expect(screen.getByText(/Ivel Valley/)).toBeInTheDocument();
    expect(screen.getByText(/· Green Belt/)).toBeInTheDocument();
  });

  it('should cap long designation lists and point at the online report', () => {
    const many = Array.from({ length: MAX_ENTITIES + 2 }, (_, i) => entity(100 + i));
    const report = makeReport({ heritage: { listedBuildings: [], conservationAreas: many, status: 'in_conservation_area' } });
    render(<DetailPages report={report} placeLine={PLACE} />);
    expect(screen.getByText(`Conservation area (${MAX_ENTITIES + 2})`)).toBeInTheDocument();
    expect(screen.getByText(`Entity ${100 + MAX_ENTITIES - 1}`)).toBeInTheDocument();
    expect(screen.queryByText(`Entity ${100 + MAX_ENTITIES}`)).toBeNull();
    expect(screen.getByText('+2 more — see the online report.')).toBeInTheDocument();
  });

  it('should mirror the on-screen wording for unavailable sources and empty results', () => {
    const report = makeReport({
      flood: null,
      epc: null,
      planningApplications: { applications: [], total: 0, status: 'none' },
      brownfield: { sites: [], status: 'none' },
    });
    render(<DetailPages report={report} placeLine={PLACE} />);
    expect(screen.getByText('Environment Agency data unavailable.')).toBeInTheDocument();
    expect(screen.getByText('No EPC found for this property on the register.')).toBeInTheDocument();
    expect(screen.getByText('No recent planning applications found nearby.')).toBeInTheDocument();
    expect(screen.getByText('Not on a local authority brownfield (previously-developed) land register.')).toBeInTheDocument();
  });
});
