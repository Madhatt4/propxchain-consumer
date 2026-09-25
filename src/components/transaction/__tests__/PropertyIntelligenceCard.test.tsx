import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { PropertyIntelligenceCard } from '../PropertyIntelligenceCard';
import type { PropertyIntelligenceReport } from '../../../services/propertyIntelligenceService';
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

// Geometry never resolves in tests → the map stays hidden and the default
// selection (Flood risk) is deterministic. The detail pane is now master-detail:
// click a source tile to reveal its card.
vi.mock('../../../services/propertyGeometryService', () => ({
  getPropertyGeometry: () => new Promise<never>(() => {}),
  datasetColor: () => '#0D9488',
  datasetLabel: (d: string) => d,
}));

// Leaflet needs a real DOM; stub the lazy-loaded map in tests.
vi.mock('../../property/PropertyMap', () => ({ default: () => null }));

// The printable PDF path uses html2pdf/canvas — stub it so the download button
// is testable in jsdom.
const exportPdf = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('../HomeMoverReportPdf', () => ({
  default: () => null,
  exportHomeMoverReportPdf: exportPdf,
}));

/** Click a source tile (button) by its title to reveal its detail card. */
function selectTile(name: RegExp): void {
  fireEvent.click(screen.getByRole('button', { name }));
}

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
    valuePerSqm: null,
    localPlanningAuthority: null,
    sources: [
      { source: 'postcodes.io', ok: true, lastFetched: Date.now() },
      { source: 'environment.data.gov.uk/flood', ok: true, lastFetched: Date.now() },
      { source: 'planning.data.gov.uk/heritage', ok: true, lastFetched: Date.now() },
      { source: 'planning.data.gov.uk/flood-zone', ok: true, lastFetched: Date.now() },
      { source: 'planning.data.gov.uk/environmental', ok: true, lastFetched: Date.now() },
      { source: 'planit.org.uk', ok: true, lastFetched: Date.now() },
      { source: 'landregistry.data.gov.uk/ppd', ok: true, lastFetched: Date.now() },
    ],
    ...overrides,
  };
}

describe('PropertyIntelligenceCard', () => {
  beforeEach(() => {
    mockGetPropertyIntelligence.mockReset();
  });

  it('renders nothing when postcode is missing', () => {
    const { container } = render(<PropertyIntelligenceCard postcode={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows a "postcode not found" message when the postcode does not geocode', () => {
    // Format-valid but nonexistent postcode (e.g. "MK43 4RD") → the service
    // returns a report with location: null (postcodes.io 404). The card must
    // explain rather than render a silent blank.
    render(
      <PropertyIntelligenceCard postcode="MK43 4RD" reportOverride={makeReport({ location: null })} />,
    );
    expect(screen.getByText(/couldn.t find that postcode/i)).toBeInTheDocument();
    expect(screen.getByText(/MK43 4RD/)).toBeInTheDocument();
  });

  it('shows the hero heading, location, and a low-risk flood tile', () => {
    render(<PropertyIntelligenceCard postcode="SG18 0AA" reportOverride={makeReport()} />);
    expect(screen.getByText('Everything we know about this property')).toBeInTheDocument();
    expect(screen.getByText(/Central Bedfordshire/)).toBeInTheDocument();
    expect(screen.getByLabelText('Flood risk: low')).toBeInTheDocument();
  });

  it('shows the selected source detail and switches on tile click', () => {
    render(<PropertyIntelligenceCard postcode="SG18 0AA" reportOverride={makeReport()} />);
    // Card opens on the Location (map) view; clicking a tile swaps the detail.
    selectTile(/Flood risk/);
    expect(screen.getByText(/No active flood warnings within 10km/)).toBeInTheDocument();
    selectTile(/Flood zone/);
    expect(screen.getByText(/not in a designated flood risk zone/i)).toBeInTheDocument();
    selectTile(/Heritage/);
    expect(screen.getByText(/No listed buildings, conservation areas/)).toBeInTheDocument();
    selectTile(/Sold prices/);
    expect(screen.getByText(/No recent sales recorded at this postcode/)).toBeInTheDocument();
  });

  it('surfaces the trusted-sources strip for credibility', () => {
    render(<PropertyIntelligenceCard postcode="SG18 0AA" reportOverride={makeReport()} />);
    expect(screen.getByText(/Verified open data from official UK sources/)).toBeInTheDocument();
    expect(screen.getByText('HM Land Registry')).toBeInTheDocument();
    expect(screen.getByText('Environment Agency')).toBeInTheDocument();
  });

  it('shows a high-risk flood tile and the active warning list', () => {
    const report = makeReport({
      flood: {
        activeWarnings: [
          {
            description: 'Flood warning for River Thames',
            severity: 'warning',
            severityLevel: 2,
            timeRaised: '2026-04-19T09:00:00Z',
            area: 'Thames at Reading',
            sourceUrl: 'https://example.gov.uk',
          },
        ],
        status: 'high',
      },
    });
    render(<PropertyIntelligenceCard postcode="RG1 1AA" reportOverride={report} />);
    expect(screen.getByLabelText('Flood risk: high')).toBeInTheDocument();
    selectTile(/Flood risk/);
    expect(screen.getByText('Thames at Reading')).toBeInTheDocument();
    expect(screen.getByText('Flood warning for River Thames')).toBeInTheDocument();
  });

  it('labels endpoints with an error tag when a source is down', () => {
    const report = makeReport({
      flood: null,
      sources: [
        { source: 'postcodes.io', ok: true, lastFetched: Date.now() },
        {
          source: 'environment.data.gov.uk/flood',
          ok: false,
          error: 'EA unreachable',
          lastFetched: Date.now(),
        },
      ],
    });
    render(<PropertyIntelligenceCard postcode="SG18 0AA" reportOverride={report} />);
    selectTile(/Flood risk/);
    expect(screen.getByText(/environment.data.gov.uk\/flood \(error\)/)).toBeInTheDocument();
    expect(screen.getByText(/Environment Agency data unavailable/)).toBeInTheDocument();
  });

  it('fetches the report when no override is provided', async () => {
    mockGetPropertyIntelligence.mockResolvedValueOnce(makeReport());
    render(<PropertyIntelligenceCard postcode="SG18 0AA" />);
    await waitFor(() => expect(screen.getByText(/Central Bedfordshire/)).toBeInTheDocument());
    expect(mockGetPropertyIntelligence).toHaveBeenCalledWith('SG18 0AA', undefined, undefined);
  });

  it('forwards the UPRN so the report uses the precise pin', async () => {
    mockGetPropertyIntelligence.mockResolvedValueOnce(makeReport());
    render(
      <PropertyIntelligenceCard postcode="SG18 0AA" addressLine="86 Fairfield Road" uprn="100100437058" />,
    );
    await waitFor(() => expect(screen.getByText(/Central Bedfordshire/)).toBeInTheDocument());
    expect(mockGetPropertyIntelligence).toHaveBeenCalledWith('SG18 0AA', '86 Fairfield Road', '100100437058');
  });

  it('renders nothing if the fetch fails', async () => {
    mockGetPropertyIntelligence.mockRejectedValueOnce(new Error('boom'));
    const { container } = render(<PropertyIntelligenceCard postcode="SG18 0AA" />);
    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  it('summarises Heritage as high when a listed building is present', () => {
    const report = makeReport({
      heritage: {
        listedBuildings: [
          {
            entity: 1,
            name: 'The Old Manor',
            dataset: 'listed-building',
            reference: 'LB-1',
            startDate: '1900-01-01',
            documentUrl: null,
          },
        ],
        conservationAreas: [],
        status: 'listed_building',
      },
    });
    render(<PropertyIntelligenceCard postcode="SG18 0AA" reportOverride={report} />);
    expect(screen.getByLabelText('Heritage risk: high')).toBeInTheDocument();
    selectTile(/Heritage/);
    expect(screen.getByText('The Old Manor')).toBeInTheDocument();
    expect(screen.getByText(/Listed building \(1\)/)).toBeInTheDocument();
  });

  it('summarises Heritage as medium when only a conservation area is present', () => {
    const report = makeReport({
      heritage: {
        listedBuildings: [],
        conservationAreas: [
          {
            entity: 2,
            name: 'Old Town Conservation Area',
            dataset: 'conservation-area',
            reference: 'CA-1',
            startDate: '1970-01-01',
            documentUrl: null,
          },
        ],
        status: 'in_conservation_area',
      },
    });
    render(<PropertyIntelligenceCard postcode="SG18 0AA" reportOverride={report} />);
    expect(screen.getByLabelText('Heritage risk: medium')).toBeInTheDocument();
    selectTile(/Heritage/);
    expect(screen.getByText('Old Town Conservation Area')).toBeInTheDocument();
  });

  it('summarises Permitted development as medium and lists the Article 4 direction', () => {
    const report = makeReport({
      article4: {
        directions: [
          {
            entity: 7010005187,
            name: 'Article 4 Basement Development Permitted Rights Removed',
            dataset: 'article-4-direction-area',
            reference: '23/00006/REG_4',
            startDate: null,
            documentUrl: null,
            detail: 'We removed permitted development rights for basement development.',
          },
        ],
        status: 'restricted',
      },
    });
    render(<PropertyIntelligenceCard postcode="W1D 3QU" reportOverride={report} />);
    expect(screen.getByLabelText('Permitted development risk: medium')).toBeInTheDocument();
    selectTile(/Permitted dev/);
    expect(screen.getByText('Article 4 Basement Development Permitted Rights Removed')).toBeInTheDocument();
    expect(screen.getByText(/removed permitted development rights for basement/i)).toBeInTheDocument();
  });

  it('summarises Permitted development as low when no Article 4 direction applies', () => {
    render(<PropertyIntelligenceCard postcode="SG18 0AA" reportOverride={makeReport()} />);
    expect(screen.getByLabelText('Permitted development risk: low')).toBeInTheDocument();
  });

  it('summarises Trees (TPO) as medium and lists the zone', () => {
    const report = makeReport({
      treePreservation: {
        zones: [
          {
            entity: 1,
            name: 'TPO 123 (1998)',
            dataset: 'tree-preservation-zone',
            reference: 'TPO-123',
            startDate: null,
            documentUrl: null,
          },
        ],
        status: 'present',
      },
    });
    render(<PropertyIntelligenceCard postcode="SG18 0AA" reportOverride={report} />);
    expect(screen.getByLabelText('Tree preservation risk: medium')).toBeInTheDocument();
    selectTile(/Tree preservation risk/);
    expect(screen.getByText('TPO 123 (1998)')).toBeInTheDocument();
  });

  it('summarises Brownfield as medium and lists the site', () => {
    const report = makeReport({
      brownfield: {
        sites: [
          {
            entity: 1,
            name: 'Former gasworks site',
            dataset: 'brownfield-site',
            reference: 'BF-1',
            startDate: null,
            documentUrl: null,
          },
        ],
        status: 'present',
      },
    });
    render(<PropertyIntelligenceCard postcode="SG18 0AA" reportOverride={report} />);
    expect(screen.getByLabelText('Brownfield risk: medium')).toBeInTheDocument();
    selectTile(/Brownfield/);
    expect(screen.getByText('Former gasworks site')).toBeInTheDocument();
  });

  it('shows the local planning authority routing line when known', () => {
    const report = makeReport({
      localPlanningAuthority: {
        entity: 626201,
        name: 'Westminster LPA',
        dataset: 'local-planning-authority',
        reference: 'E60000201',
        startDate: null,
        documentUrl: null,
      },
    });
    render(<PropertyIntelligenceCard postcode="W1D 3QU" reportOverride={report} />);
    expect(screen.getByText(/Local planning authority: Westminster LPA/)).toBeInTheDocument();
  });

  it('renders scheduled monuments and World Heritage Sites in the heritage section', () => {
    const report = makeReport({
      heritage: {
        listedBuildings: [],
        conservationAreas: [],
        scheduledMonuments: [
          { entity: 1, name: 'Roman Baths', dataset: 'scheduled-monument', reference: 'SM-1', startDate: null, documentUrl: null },
        ],
        worldHeritageSites: [
          { entity: 2, name: 'City of Bath', dataset: 'world-heritage-site', reference: 'WHS-1', startDate: null, documentUrl: null },
        ],
        status: 'listed_building',
      },
    });
    render(<PropertyIntelligenceCard postcode="BA1 1LZ" reportOverride={report} />);
    selectTile(/Heritage/);
    expect(screen.getByText('Roman Baths')).toBeInTheDocument();
    expect(screen.getByText('City of Bath')).toBeInTheDocument();
  });

  it('summarises Flood zone as high when zone_3 is present', () => {
    const report = makeReport({
      floodZone: {
        zones: [
          {
            entity: 9,
            name: 'Flood Zone 3',
            dataset: 'flood-risk-zone',
            reference: 'FRZ-3',
            startDate: null,
            documentUrl: null,
          },
        ],
        status: 'zone_3',
      },
    });
    render(<PropertyIntelligenceCard postcode="SG18 0AA" reportOverride={report} />);
    expect(screen.getByLabelText('Flood zone risk: high')).toBeInTheDocument();
  });

  it('summarises Environment as medium with one designation and renders a nice label', () => {
    const report = makeReport({
      environmental: {
        designations: [
          {
            entity: 11,
            name: 'Chilterns AONB',
            dataset: 'area-of-outstanding-natural-beauty',
            reference: 'AONB-Chilterns',
            startDate: null,
            documentUrl: null,
          },
        ],
        status: 'single',
      },
    });
    render(<PropertyIntelligenceCard postcode="HP9 1AA" reportOverride={report} />);
    expect(screen.getByLabelText('Environment risk: medium')).toBeInTheDocument();
    selectTile(/Environment/);
    expect(screen.getAllByText('AONB').length).toBeGreaterThan(0);
    expect(screen.getByText('Chilterns AONB')).toBeInTheDocument();
  });

  it('summarises Planning as medium with some applications and lists them', () => {
    const report = makeReport({
      planningApplications: {
        applications: [
          {
            uid: 'app-1',
            reference: '24/01234/FUL',
            description: 'Single-storey rear extension',
            appState: 'Approved',
            address: '10 Example Road',
            startDate: '2024-03-15',
            decidedDate: '2024-06-10',
            distanceM: 48,
            url: 'https://example-council.gov.uk/apps/24-01234',
          },
        ],
        total: 2,
        status: 'some',
      },
    });
    render(<PropertyIntelligenceCard postcode="SG18 0AA" reportOverride={report} />);
    expect(screen.getByLabelText('Planning risk: medium')).toBeInTheDocument();
    selectTile(/Planning/);
    expect(screen.getByText('24/01234/FUL')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText(/Single-storey rear extension/)).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 of 2 applications/)).toBeInTheDocument();
  });

  it('summarises Planning as high when many applications are nearby', () => {
    const apps = Array.from({ length: 8 }).map((_, i) => ({
      uid: `app-${i}`,
      reference: `24/0${i}/FUL`,
      description: 'Extension',
      appState: 'Pending',
      address: `${i} Example Road`,
      startDate: '2024-03-15',
      decidedDate: null,
      distanceM: 100 + i * 10,
      url: 'https://example.council.gov.uk/',
    }));
    const report = makeReport({
      planningApplications: { applications: apps, total: apps.length, status: 'many' },
    });
    render(<PropertyIntelligenceCard postcode="SG18 0AA" reportOverride={report} />);
    expect(screen.getByLabelText('Planning risk: high')).toBeInTheDocument();
  });

  it('renders the sale history section with average and most recent', () => {
    const sale = {
      amount: 425000,
      date: '2024-08-15',
      paon: '10',
      street: 'Example Road',
      propertyType: 'semi-detached',
    };
    const report = makeReport({
      pricePaid: {
        sales: [sale, { ...sale, amount: 375000, date: '2022-01-10' }],
        averagePrice: 400000,
        latestSale: sale,
      },
    });
    render(<PropertyIntelligenceCard postcode="SG18 0AA" reportOverride={report} />);
    selectTile(/Sold prices/);
    expect(screen.getByText(/2 sales found · average/)).toBeInTheDocument();
    // £400,000 may appear in both the detail card and the "Sold prices" tile.
    expect(screen.getAllByText(/£400,000/).length).toBeGreaterThan(0);
    expect(screen.getByText(/most recent £425,000 on 2024-08-15/)).toBeInTheDocument();
  });

  it('renders the EPC section with band, floor area, £/m² and MEES status', () => {
    const report = makeReport({
      epc: {
        address: '86 Fairfield Road, BIGGLESWADE',
        postcode: 'SG18 0AA',
        uprn: '100080064516',
        currentBand: 'C',
        potentialBand: 'B',
        currentRating: 69,
        potentialRating: 82,
        floorAreaSqm: 93,
        lodgementDate: '2023-06-13',
        meetsMees: true,
      },
      valuePerSqm: 4570,
    });
    render(<PropertyIntelligenceCard postcode="SG18 0AA" reportOverride={report} />);
    selectTile(/Energy/);
    expect(screen.getByText('Energy performance (EPC)')).toBeInTheDocument();
    expect(screen.getByLabelText('EPC band C')).toBeInTheDocument();
    expect(screen.getByLabelText('EPC band B')).toBeInTheDocument();
    expect(screen.getByText(/93 m²/)).toBeInTheDocument();
    expect(screen.getByText(/£4,570/)).toBeInTheDocument();
    expect(screen.getByText(/Meets MEES/)).toBeInTheDocument();
  });

  it('shows a graceful note when no EPC is on the register', () => {
    render(<PropertyIntelligenceCard postcode="SG18 0AA" reportOverride={makeReport()} />);
    selectTile(/Energy/);
    expect(screen.getByText(/No EPC found for this property/)).toBeInTheDocument();
  });

  it('flags a sub-MEES property (band F/G)', () => {
    const report = makeReport({
      epc: {
        address: '1 Old Cottage',
        postcode: 'SG18 0AA',
        uprn: null,
        currentBand: 'F',
        potentialBand: 'D',
        currentRating: 32,
        potentialRating: 58,
        floorAreaSqm: 70,
        lodgementDate: '2019-01-01',
        meetsMees: false,
      },
      valuePerSqm: null,
    });
    render(<PropertyIntelligenceCard postcode="SG18 0AA" reportOverride={report} />);
    selectTile(/Energy/);
    expect(screen.getByText(/Below MEES/)).toBeInTheDocument();
  });

  describe('anomalies', () => {
    function makeAnomaly(overrides: Partial<CrossReferenceResult> = {}): CrossReferenceResult {
      return {
        formSection: 'TA6 §7 Environmental Issues',
        formField: 'environmentalIssues',
        formValue: [],
        propertyIntelSource: 'planning.data.gov.uk/flood-zone',
        propertyIntelValue: 'zone_3',
        conflictType: 'contradiction',
        severity: 'critical',
        message: 'Property sits in Flood Zone 3 but section 7 does not declare flooding.',
        suggestedAction: 'Add a clarification note to TA6 §7.',
        ...overrides,
      };
    }

    it('shows an "Anomalies" count badge in the hero when flags are provided', () => {
      render(
        <PropertyIntelligenceCard
          postcode="SG18 0AA"
          reportOverride={makeReport()}
          anomalies={[makeAnomaly(), makeAnomaly({ severity: 'warning' })]}
        />,
      );
      expect(screen.getByLabelText(/Anomalies: 2/)).toBeInTheDocument();
    });

    it('does not show the badge when the anomalies array is empty or undefined', () => {
      render(
        <PropertyIntelligenceCard
          postcode="SG18 0AA"
          reportOverride={makeReport()}
          anomalies={[]}
        />,
      );
      expect(screen.queryByLabelText(/Anomalies:/)).toBeNull();
    });

    it('renders the Anomalies detail card', () => {
      const a1 = makeAnomaly({
        severity: 'critical',
        message: 'Flood Zone 3 mismatch',
      });
      const a2 = makeAnomaly({
        severity: 'warning',
        formSection: 'TA6 §4 Alterations',
        message: 'Approved planning record nearby.',
        suggestedAction: 'Clarify whether works relate to this property.',
      });
      render(
        <PropertyIntelligenceCard
          postcode="SG18 0AA"
          reportOverride={makeReport()}
          anomalies={[a1, a2]}
        />,
      );
      expect(screen.getByLabelText('Form cross-reference anomalies')).toBeInTheDocument();
      expect(screen.getByText('Anomalies (2)')).toBeInTheDocument();
      expect(screen.getByText('Flood Zone 3 mismatch')).toBeInTheDocument();
      expect(screen.getByText('Approved planning record nearby.')).toBeInTheDocument();
      expect(
        screen.getByText(/Clarify whether works relate to this property/),
      ).toBeInTheDocument();
    });

    it('omits the Anomalies section when no flags are present', () => {
      render(
        <PropertyIntelligenceCard postcode="SG18 0AA" reportOverride={makeReport()} />,
      );
      expect(screen.queryByText(/^Anomalies \(/)).toBeNull();
    });
  });

  it('summarises Environment as high with multiple designations', () => {
    const report = makeReport({
      environmental: {
        designations: [
          {
            entity: 11,
            name: 'North Downs Green Belt',
            dataset: 'green-belt',
            reference: 'GB-1',
            startDate: null,
            documentUrl: null,
          },
          {
            entity: 12,
            name: 'Epsom Common SSSI',
            dataset: 'site-of-special-scientific-interest',
            reference: 'SSSI-1',
            startDate: null,
            documentUrl: null,
          },
        ],
        status: 'multiple',
      },
    });
    render(<PropertyIntelligenceCard postcode="KT18 5AA" reportOverride={report} />);
    expect(screen.getByLabelText('Environment risk: high')).toBeInTheDocument();
  });

  describe('download', () => {
    it('offers a PDF download when downloadable, and never emails anything', async () => {
      render(<PropertyIntelligenceCard postcode="SG18 0AA" reportOverride={makeReport()} downloadable />);
      fireEvent.click(screen.getByRole('button', { name: /download your report/i }));
      await waitFor(() => expect(exportPdf).toHaveBeenCalledTimes(1));
      expect(screen.queryByText(/email/i)).not.toBeInTheDocument();
    });

    it('re-enables the button when the export fails', async () => {
      exportPdf.mockRejectedValueOnce(new Error('canvas'));
      render(<PropertyIntelligenceCard postcode="SG18 0AA" reportOverride={makeReport()} downloadable />);
      fireEvent.click(screen.getByRole('button', { name: /download your report/i }));
      await waitFor(() => expect(screen.getByRole('button', { name: /download your report/i })).not.toBeDisabled());
    });

    it('shows no download button unless downloadable', () => {
      render(<PropertyIntelligenceCard postcode="SG18 0AA" reportOverride={makeReport()} />);
      expect(screen.queryByRole('button', { name: /download your report/i })).not.toBeInTheDocument();
    });
  });
});
