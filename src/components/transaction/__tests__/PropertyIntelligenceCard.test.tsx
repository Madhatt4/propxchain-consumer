import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { PropertyIntelligenceCard } from '../PropertyIntelligenceCard';
import type { PropertyIntelligenceReport, PriceSale } from '../../../services/propertyIntelligenceService';
import type { CrossReferenceResult } from '../../../services/formCrossReferenceService';

const mockGetPropertyIntelligence = vi.fn();

vi.mock('../../../services/propertyIntelligenceService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/propertyIntelligenceService')>(
    '../../../services/propertyIntelligenceService',
  );
  return {
    ...actual,
    getPropertyIntelligence: (...args: unknown[]) => mockGetPropertyIntelligence(...args),
  };
});

// Geometry never resolves in tests, so the section maps that need designation
// boundaries stay hidden and the output is deterministic.
vi.mock('../../../services/propertyGeometryService', () => ({
  getPropertyGeometry: () => new Promise<never>(() => {}),
  datasetColor: () => '#0D9488',
  datasetLabel: (d: string) => d,
}));

// Leaflet needs a real DOM; stub the lazy-loaded map in tests.
vi.mock('../../property/PropertyMap', () => ({ default: () => null }));
// Recharts needs layout APIs jsdom lacks; the chart has no logic under test here.
vi.mock('../report/PriceChart', () => ({ default: () => null }));

// The printable PDF path uses html2pdf/canvas — stub it so the download button
// is testable in jsdom.
const exportPdf = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('../HomeMoverReportPdf', () => ({
  default: () => null,
  exportHomeMoverReportPdf: exportPdf,
}));

function makeReport(overrides: Partial<PropertyIntelligenceReport> = {}): PropertyIntelligenceReport {
  return {
    postcode: 'SG18 0AA',
    fetchedAt: Date.now(),
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
    surfaceWater: { band: 'very_low', confidence: null },
    coalMining: { inHighRiskArea: false },
    radon: { classMax: 1, description: 'Lowest band.', gridSquare: 'TL1748' },
    coverageGap: null,
    valuePerSqm: null,
    localPlanningAuthority: null,
    sources: [{ source: 'postcodes.io', ok: true, lastFetched: Date.now() }],
    ...overrides,
  };
}

const entity = (name: string, dataset: string, extra: Record<string, unknown> = {}) => ({
  entity: 1,
  name,
  dataset,
  reference: 'REF1',
  startDate: null,
  documentUrl: null,
  ...extra,
});

function section(name: RegExp): HTMLElement {
  return screen.getByRole('region', { name });
}

describe('PropertyIntelligenceCard', () => {
  beforeEach(() => {
    mockGetPropertyIntelligence.mockReset();
    exportPdf.mockClear();
  });

  describe('loading and states', () => {
    it('renders nothing when postcode is missing', () => {
      const { container } = render(<PropertyIntelligenceCard postcode={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('explains a postcode that does not geocode instead of rendering blank', () => {
      render(<PropertyIntelligenceCard postcode="MK43 4RD" reportOverride={makeReport({ location: null })} />);
      expect(screen.getByText(/couldn.t find that postcode/i)).toBeInTheDocument();
      expect(screen.getByText(/MK43 4RD/)).toBeInTheDocument();
    });

    it('fetches the report with the address line and UPRN when no override is given', async () => {
      mockGetPropertyIntelligence.mockResolvedValueOnce(makeReport());
      render(<PropertyIntelligenceCard postcode="SG18 0AA" addressLine="86 Fairfield Road" uprn="100100437058" />);
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Property report' })).toBeInTheDocument());
      expect(mockGetPropertyIntelligence).toHaveBeenCalledWith('SG18 0AA', '86 Fairfield Road', '100100437058');
    });

    it('shows a failed load with a retry that runs the check again', async () => {
      mockGetPropertyIntelligence.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(makeReport());
      render(<PropertyIntelligenceCard postcode="SG18 0AA" />);

      await waitFor(() => expect(screen.getByText(/couldn.t load this report/i)).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /try again/i }));

      await waitFor(() => expect(screen.getByRole('heading', { name: 'Property report' })).toBeInTheDocument());
      expect(mockGetPropertyIntelligence).toHaveBeenCalledTimes(2);
    });
  });

  describe('document layout', () => {
    it('opens with the address, the section bar and a clean summary', () => {
      render(<PropertyIntelligenceCard postcode="SG18 0AA" addressLine="14a" reportOverride={makeReport()} />);

      expect(screen.getByText(/14a, SG18 0AA · Central Bedfordshire/)).toBeInTheDocument();
      const nav = screen.getByRole('navigation', { name: 'Report sections' });
      for (const label of ['Summary', 'Flood', 'Radon and ground', 'Heritage and rules', 'Sold prices', 'Energy', 'Planning', 'Who to ask']) {
        expect(within(nav).getByRole('link', { name: label })).toHaveAttribute('href', expect.stringMatching(/^#report-/));
      }
      expect(screen.getByRole('heading', { name: 'Nothing stands out at 14a, SG18 0AA' })).toBeInTheDocument();
      expect(screen.getByText(/Came back clear: flood zone, surface water, coal mining, radon/)).toBeInTheDocument();
    });

    it('ranks hazards before constraints and never shows a listed building as a hazard', () => {
      render(
        <PropertyIntelligenceCard
          postcode="SG18 0AA"
          reportOverride={makeReport({
            floodZone: { zones: [entity('Flood zone 3', 'flood-risk-zone')], status: 'zone_3' },
            coalMining: { inHighRiskArea: true },
            heritage: { listedBuildings: [entity('The Old Manor', 'listed-building', { grade: 'II' })], conservationAreas: [], status: 'listed_building' },
          })}
        />,
      );

      const summary = section(/What stands out/);
      const items = within(summary).getAllByRole('link').map((a) => a.textContent ?? '');
      expect(items[0]).toMatch(/In Flood Zone 3.*\(serious\)/);
      expect(items[1]).toMatch(/Coal mining high risk area.*\(serious\)/);
      expect(items[2]).toMatch(/Grade II listed building.*\(limits changes\)/);

      const heritage = section(/Heritage and planning rules/);
      expect(within(heritage).getByText(/not a hazard/)).toBeInTheDocument();
      expect(within(heritage).getByText('Grade II: The Old Manor')).toBeInTheDocument();
    });

    it('explains the flood zone and surface water band in plain words', () => {
      render(
        <PropertyIntelligenceCard
          postcode="SG18 0AA"
          reportOverride={makeReport({ surfaceWater: { band: 'medium', confidence: 1 } })}
        />,
      );
      const flood = section(/^Flood$/);
      expect(within(flood).getByText('Some flood risk at this address.')).toBeInTheDocument();
      expect(within(flood).getByRole('img', { name: 'Surface water flood risk: Medium' })).toBeInTheDocument();
      expect(within(flood).getByText('Between a 1% and 3.3% chance each year.')).toBeInTheDocument();
      expect(within(flood).getByText('Flood Zone 1')).toBeInTheDocument();
    });

    it('says the England-only checks are not covered for a Welsh address instead of calling them clear', () => {
      render(
        <PropertyIntelligenceCard
          postcode="LL28 5ND"
          reportOverride={makeReport({ coverageGap: 'Wales', flood: null, floodZone: null, surfaceWater: null, heritage: null, article4: null, treePreservation: null, brownfield: null, environmental: null })}
        />,
      );
      expect(within(section(/^Flood$/)).getByText(/Not covered in Wales/)).toBeInTheDocument();
      expect(within(section(/Heritage and planning rules/)).getByText(/Not covered in Wales/)).toBeInTheDocument();
      expect(screen.queryByText('Flood Zone 1')).not.toBeInTheDocument();
      expect(screen.getByText(/not shown for this address in Wales/)).toBeInTheDocument();
    });
  });

  describe('sections with data', () => {
    const sales: PriceSale[] = Array.from({ length: 12 }, (_, i) => ({
      amount: 200000 + i * 10000,
      date: `${2010 + i}-06-01`,
      paon: String(i + 1),
      street: 'OAK ROAD',
      propertyType: i % 2 ? 'terraced' : 'otherPropertyType',
    }));

    it('lists the latest ten sales in plain words, with a control to show all', () => {
      render(<PropertyIntelligenceCard postcode="SG18 0AA" reportOverride={makeReport({ pricePaid: { sales, averagePrice: 255000, latestSale: sales[11] } })} />);
      const prices = section(/Sold prices on SG18 0AA/);

      expect(within(prices).getByText(/12 sales recorded since 2010. The most recent was £310,000 in Jun 2021./)).toBeInTheDocument();
      expect(within(prices).getAllByRole('row')).toHaveLength(11);
      expect(within(prices).getAllByText('Other').length).toBeGreaterThan(0);
      fireEvent.click(within(prices).getByRole('button', { name: 'Show all 12 sales' }));
      expect(within(prices).getAllByRole('row')).toHaveLength(13);
    });

    it('shows the EPC on the A to G ladder with floor area and the letting standard', () => {
      render(
        <PropertyIntelligenceCard
          postcode="SG18 0AA"
          reportOverride={makeReport({
            epc: { address: '1 Oak Road', postcode: 'SG18 0AA', uprn: null, currentBand: 'F', potentialBand: 'C', currentRating: 30, potentialRating: 72, floorAreaSqm: 84, lodgementDate: '2024-03-01', meetsMees: false },
          })}
        />,
      );
      const energy = section(/^Energy$/);
      expect(within(energy).getByText('Energy rating F (30).')).toBeInTheDocument();
      expect(within(energy).getByText('Current 30')).toBeInTheDocument();
      expect(within(energy).getByText('Potential 72')).toBeInTheDocument();
      expect(within(energy).getByText('84 m²')).toBeInTheDocument();
      expect(within(energy).getByText(/Below the minimum for letting/)).toBeInTheDocument();
    });

    it('lists nearby planning applications nearest first', () => {
      const app = (uid: string, distanceM: number, appState: string) => ({ uid, reference: uid, description: `Proposal ${uid}`, appState, address: '', startDate: '2025-01-10', decidedDate: null, distanceM, url: '' });
      render(
        <PropertyIntelligenceCard
          postcode="SG18 0AA"
          reportOverride={makeReport({ planningApplications: { applications: [app('far', 250, 'Refused'), app('near', 20, 'Approved')], total: 2, status: 'some' } })}
        />,
      );
      const rows = within(section(/Planning applications nearby/)).getAllByRole('row');
      expect(rows[1]).toHaveTextContent('Proposal near');
      expect(rows[2]).toHaveTextContent('Proposal far');
    });

    it('never reads a ground check that failed to load as nothing found', () => {
      render(<PropertyIntelligenceCard postcode="SG18 0AA" reportOverride={makeReport({ radon: null, coalMining: null })} />);
      const ground = section(/Radon and ground/);
      expect(within(ground).getByText('Some ground checks didn’t load.')).toBeInTheDocument();
      expect(within(ground).queryByText('Nothing found.')).not.toBeInTheDocument();
    });

    it('tells a register that did not answer apart from a missing certificate', () => {
      render(
        <PropertyIntelligenceCard
          postcode="SG18 0AA"
          reportOverride={makeReport({ sources: [{ source: 'get-energy-performance-data.communities.gov.uk', ok: false, error: 'timeout', lastFetched: Date.now() }] })}
        />,
      );
      expect(within(section(/^Energy$/)).getByText(/register didn’t respond/)).toBeInTheDocument();
    });

    it('builds who-to-ask questions from the findings', () => {
      render(<PropertyIntelligenceCard postcode="SG18 0AA" reportOverride={makeReport({ radon: { classMax: 5, description: '', gridSquare: 'SK1' } })} />);
      const ask = section(/Who to ask/);
      expect(within(ask).getByText(/Has a radon test been done/)).toBeInTheDocument();
      expect(within(ask).getByText(/Note any radon sump or membrane/)).toBeInTheDocument();
    });

    it('names a source that did not answer in plain words', () => {
      render(
        <PropertyIntelligenceCard
          postcode="SG18 0AA"
          reportOverride={makeReport({ planningApplications: null, sources: [{ source: 'planit.org.uk', ok: false, error: '503', lastFetched: Date.now() }] })}
        />,
      );
      expect(screen.getByText(/Didn’t answer this time: UK PlanIt planning applications/)).toBeInTheDocument();
      expect(within(section(/Planning applications nearby/)).getByText(/UK PlanIt didn’t respond/)).toBeInTheDocument();
    });

    it('shows form anomalies under the summary', () => {
      const anomaly: CrossReferenceResult = {
        formSection: 'TA6 §7 Environmental Issues',
        formField: 'environmentalIssues',
        formValue: [],
        propertyIntelSource: 'planning.data.gov.uk/flood-zone',
        propertyIntelValue: 'zone_3',
        conflictType: 'contradiction',
        severity: 'critical',
        message: 'Property sits in Flood Zone 3 but section 7 does not declare flooding.',
        suggestedAction: 'Add a clarification note to TA6 §7.',
      };
      render(<PropertyIntelligenceCard postcode="SG18 0AA" reportOverride={makeReport()} anomalies={[anomaly]} />);
      expect(screen.getByText(/does not declare flooding/)).toBeInTheDocument();
    });
  });

  describe('download', () => {
    it('offers a PDF download when downloadable, and never emails anything', async () => {
      render(<PropertyIntelligenceCard postcode="SG18 0AA" reportOverride={makeReport()} downloadable />);
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }));
      await waitFor(() => expect(exportPdf).toHaveBeenCalledTimes(1));
      expect(screen.queryByText(/email/i)).not.toBeInTheDocument();
    });

    it('re-enables the button when the export fails', async () => {
      exportPdf.mockRejectedValueOnce(new Error('canvas'));
      render(<PropertyIntelligenceCard postcode="SG18 0AA" reportOverride={makeReport()} downloadable />);
      fireEvent.click(screen.getByRole('button', { name: /download pdf/i }));
      await waitFor(() => expect(screen.getByRole('button', { name: /download pdf/i })).not.toBeDisabled());
    });

    it('shows no download button unless downloadable', () => {
      render(<PropertyIntelligenceCard postcode="SG18 0AA" reportOverride={makeReport()} />);
      expect(screen.queryByRole('button', { name: /download pdf/i })).not.toBeInTheDocument();
    });
  });
});
