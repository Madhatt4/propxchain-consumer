import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  getPostcodeInfo,
  getFloodRisk,
  getHeritageAssets,
  getArticle4Directions,
  getTreePreservation,
  getBrownfield,
  getLocalPlanningAuthority,
  getFloodZone,
  getEnvironmentalDesignations,
  getPlanningApplications,
  getPricePaidHistory,
  getPropertyIntelligence,
  getEpcCached,
} from '../propertyIntelligenceService';
import { lookupEpc } from '../epc.service';
import { getTitleBoundary } from '../titlePolygon.service';

// EPC flows through a Supabase edge function (not fetch), so mock the client.
vi.mock('../epc.service', () => ({ lookupEpc: vi.fn(async () => null) }));
const mockLookupEpc = vi.mocked(lookupEpc);

// Title boundary goes via a Supabase RPC (not fetch). Default: no polygon →
// point-intersect (today's behaviour). Individual tests override it.
vi.mock('../titlePolygon.service', () => ({ getTitleBoundary: vi.fn(async () => null) }));
const mockGetTitleBoundary = vi.mocked(getTitleBoundary);

const originalFetch = globalThis.fetch;

function mockJsonResponse(payload: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    headers: new Headers(),
    json: async () => payload,
  } as unknown as Response;
}

describe('getPostcodeInfo', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns normalized info from Postcodes.io', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({
        status: 200,
        result: {
          postcode: 'SG18 0AA',
          latitude: 52.087,
          longitude: -0.275,
          admin_district: 'Central Bedfordshire',
          admin_ward: 'Biggleswade North',
          country: 'England',
          region: 'East of England',
        },
      }),
    );
    const info = await getPostcodeInfo('sg180aa');
    expect(info.coordinates.lat).toBe(52.087);
    expect(info.admin_district).toBe('Central Bedfordshire');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.postcodes.io/postcodes/SG180AA'),
      expect.any(Object),
    );
  });

  it('caches results across calls', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({
        status: 200,
        result: {
          postcode: 'SW1A 1AA',
          latitude: 51.5,
          longitude: -0.14,
          admin_district: 'Westminster',
          admin_ward: 'St James',
          country: 'England',
          region: 'London',
        },
      }),
    );
    await getPostcodeInfo('SW1A 1AA');
    await getPostcodeInfo('SW1A 1AA');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws on empty postcode', async () => {
    await expect(getPostcodeInfo('  ')).rejects.toThrow('empty');
  });

  it('throws on non-200 response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({}, false, 404),
    );
    await expect(getPostcodeInfo('AB1 2CD')).rejects.toThrow(/404/);
  });
});

describe('getFloodRisk', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns status=low when no warnings are active', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({ items: [] }),
    );
    const result = await getFloodRisk({ lat: 52.087, lng: -0.275 });
    expect(result.status).toBe('low');
    expect(result.activeWarnings).toHaveLength(0);
  });

  it('flags status=high when a Flood Warning (severity level 2) is active', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({
        items: [
          {
            description: 'Flood warning for River Thames',
            severity: 'Flood Warning',
            severityLevel: 2,
            timeRaised: '2026-04-19T09:00:00Z',
            floodArea: { description: 'Thames at Reading' },
            '@id': 'https://example.gov.uk/flood-1',
          },
        ],
      }),
    );
    const result = await getFloodRisk({ lat: 51.5, lng: -1.0 });
    expect(result.status).toBe('high');
    expect(result.activeWarnings[0].severity).toBe('warning');
    expect(result.activeWarnings[0].area).toBe('Thames at Reading');
  });

  it('flags status=medium for a Flood Alert (severity level 3)', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({
        items: [
          {
            description: 'Flood alert',
            severity: 'Flood Alert',
            severityLevel: 3,
            timeRaised: '2026-04-19T09:00:00Z',
            floodArea: { description: 'Lower Ouse' },
          },
        ],
      }),
    );
    const result = await getFloodRisk({ lat: 52.0, lng: -0.5 });
    expect(result.status).toBe('medium');
  });

  it('ignores warnings that are no longer in force for status calc', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({
        items: [
          {
            description: 'Historic',
            severity: 'Warning no Longer in Force',
            severityLevel: 4,
            timeRaised: '2024-01-01T00:00:00Z',
          },
        ],
      }),
    );
    const result = await getFloodRisk({ lat: 52.0, lng: -0.5 });
    expect(result.status).toBe('low');
    expect(result.activeWarnings).toHaveLength(1);
  });
});

describe('getHeritageAssets', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('splits entities by dataset and reports status correctly', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({
        entities: [
          {
            entity: 1,
            name: 'The Old Manor',
            dataset: 'listed-building',
            reference: 'LB-1',
            'start-date': '1900-01-01',
            'document-url': 'https://historicengland.org.uk/1',
          },
          {
            entity: 2,
            name: 'Biggleswade Town Centre CA',
            dataset: 'conservation-area',
            reference: 'CA-1',
            'start-date': '1970-01-01',
          },
        ],
        count: 2,
      }),
    );
    const data = await getHeritageAssets({ lat: 52.087, lng: -0.275 });
    expect(data.listedBuildings).toHaveLength(1);
    expect(data.conservationAreas).toHaveLength(1);
    expect(data.status).toBe('both');
    expect(data.listedBuildings[0].name).toBe('The Old Manor');
  });

  it('reports status=none when no entities are returned', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({ entities: [], count: 0 }),
    );
    const data = await getHeritageAssets({ lat: 52.087, lng: -0.275 });
    expect(data.status).toBe('none');
  });
});

describe('getHeritageAssets (grade)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('captures the listed-building grade when present', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({
        entities: [
          {
            entity: 1,
            name: 'The Old Manor',
            dataset: 'listed-building',
            reference: 'LB-1',
            'listed-building-grade': 'II*',
          },
        ],
        count: 1,
      }),
    );
    const data = await getHeritageAssets({ lat: 52.087, lng: -0.275 });
    expect(data.listedBuildings[0].grade).toBe('II*');
  });

  it('splits scheduled monuments and World Heritage Sites and elevates status', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({
        entities: [
          { entity: 1, name: 'Roman Baths', dataset: 'scheduled-monument', reference: 'SM-1' },
          { entity: 2, name: 'City of Bath', dataset: 'world-heritage-site', reference: 'WHS-1' },
          { entity: 3, name: 'WHS buffer', dataset: 'world-heritage-site-buffer-zone', reference: 'WHSB-1' },
        ],
        count: 3,
      }),
    );
    const data = await getHeritageAssets({ lat: 51.381, lng: -2.359 });
    expect(data.scheduledMonuments).toHaveLength(1);
    expect(data.worldHeritageSites).toHaveLength(2); // site + buffer zone
    // No listed building or conservation area, but monuments/WHS elevate to high-significance.
    expect(data.status).toBe('listed_building');
  });
});

describe('getTreePreservation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('reports present when a TPO zone intersects', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({ entities: [{ entity: 1, name: 'TPO 123', dataset: 'tree-preservation-zone', reference: 'TPO-123' }] }),
    );
    const data = await getTreePreservation({ lat: 52.0, lng: -0.5 });
    expect(data.status).toBe('present');
    expect(data.zones).toHaveLength(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('dataset=tree-preservation-zone'),
      expect.any(Object),
    );
  });

  it('reports none when no TPO zone intersects', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockJsonResponse({ entities: [] }));
    const data = await getTreePreservation({ lat: 52.0, lng: -0.5 });
    expect(data.status).toBe('none');
  });
});

describe('getBrownfield', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('reports present and queries both brownfield datasets', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({ entities: [{ entity: 1, name: 'Former depot', dataset: 'brownfield-site', reference: 'BF-1' }] }),
    );
    const data = await getBrownfield({ lat: 52.0, lng: -0.5 });
    expect(data.status).toBe('present');
    expect(data.sites).toHaveLength(1);
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('dataset=brownfield-land');
    expect(url).toContain('dataset=brownfield-site');
  });

  it('reports none when not on a brownfield register', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockJsonResponse({ entities: [] }));
    const data = await getBrownfield({ lat: 52.0, lng: -0.5 });
    expect(data.status).toBe('none');
  });
});

describe('getLocalPlanningAuthority', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns the first LPA match', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({
        entities: [{ entity: 626201, name: 'Westminster LPA', dataset: 'local-planning-authority', reference: 'E60000201' }],
      }),
    );
    const lpa = await getLocalPlanningAuthority({ lat: 51.51, lng: -0.134 });
    expect(lpa?.name).toBe('Westminster LPA');
  });

  it('returns null when no LPA is found', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockJsonResponse({ entities: [] }));
    const lpa = await getLocalPlanningAuthority({ lat: 0, lng: 0 });
    expect(lpa).toBeNull();
  });
});

describe('getArticle4Directions', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('reports restricted and captures the direction detail when an Article 4 area intersects', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({
        entities: [
          {
            entity: 7010005187,
            name: 'Article 4 Basement Development Permitted Rights Removed',
            dataset: 'article-4-direction-area',
            reference: '23/00006/REG_4',
            description: 'We removed permitted development rights for basement development.',
          },
        ],
        count: 1,
      }),
    );
    const data = await getArticle4Directions({ lat: 51.51, lng: -0.134 });
    expect(data.status).toBe('restricted');
    expect(data.directions).toHaveLength(1);
    expect(data.directions[0].detail).toMatch(/permitted development rights/i);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('dataset=article-4-direction-area'),
      expect.any(Object),
    );
  });

  it('reports none when no Article 4 directions intersect', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({ entities: [], count: 0 }),
    );
    const data = await getArticle4Directions({ lat: 52.0, lng: -0.5 });
    expect(data.status).toBe('none');
    expect(data.directions).toHaveLength(0);
  });
});

describe('getFloodZone', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('reports zone_3 when the entity name mentions zone 3', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({
        entities: [
          { entity: 9, name: 'Flood Zone 3', dataset: 'flood-risk-zone', reference: 'FZ-3' },
        ],
      }),
    );
    const data = await getFloodZone({ lat: 52.087, lng: -0.275 });
    expect(data.status).toBe('zone_3');
  });

  it('reports zone_2 when the entity mentions zone 2', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({
        entities: [
          { entity: 9, name: 'Flood Zone 2', dataset: 'flood-risk-zone', reference: 'FZ-2' },
        ],
      }),
    );
    const data = await getFloodZone({ lat: 52.087, lng: -0.275 });
    expect(data.status).toBe('zone_2');
  });

  it('reports none when no flood zones intersect', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({ entities: [] }),
    );
    const data = await getFloodZone({ lat: 52.087, lng: -0.275 });
    expect(data.status).toBe('none');
  });
});

describe('getEnvironmentalDesignations', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('reports multiple when more than one designation intersects', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({
        entities: [
          { entity: 1, name: 'Epsom Common SSSI', dataset: 'site-of-special-scientific-interest', reference: 'SSSI-1' },
          { entity: 2, name: 'Green Belt', dataset: 'green-belt', reference: 'GB-1' },
        ],
      }),
    );
    const data = await getEnvironmentalDesignations({ lat: 51.3, lng: -0.25 });
    expect(data.status).toBe('multiple');
    expect(data.designations).toHaveLength(2);
  });

  it('reports single for exactly one designation', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({
        entities: [
          { entity: 1, name: 'Chilterns AONB', dataset: 'area-of-outstanding-natural-beauty', reference: 'AONB-1' },
        ],
      }),
    );
    const data = await getEnvironmentalDesignations({ lat: 51.6, lng: -0.8 });
    expect(data.status).toBe('single');
  });

  it('reports none when no designations are returned', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({ entities: [] }),
    );
    const data = await getEnvironmentalDesignations({ lat: 52.0, lng: -0.5 });
    expect(data.status).toBe('none');
  });
});

describe('getPlanningApplications', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('normalizes PlanIt records and converts distance km → m', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({
        records: [
          {
            uid: 'app-1',
            reference: '24/01234/FUL',
            description: 'Extension',
            app_state: 'Approved',
            address: '10 Example Road',
            start_date: '2024-03-15',
            decided_date: '2024-06-10',
            distance: 0.048,
            url: 'https://example.council.gov.uk/',
          },
        ],
        total: 1,
      }),
    );
    const data = await getPlanningApplications({ lat: 52.087, lng: -0.275 });
    expect(data.applications).toHaveLength(1);
    expect(data.applications[0].distanceM).toBe(48);
    expect(data.applications[0].reference).toBe('24/01234/FUL');
    expect(data.status).toBe('some');
  });

  it('reports status=many when total >= 6', async () => {
    const records = Array.from({ length: 8 }).map((_, i) => ({
      uid: `app-${i}`,
      reference: `R${i}`,
      description: 'x',
      app_state: 'Pending',
      address: 'x',
      distance: 0.1,
    }));
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({ records, total: 8 }),
    );
    const data = await getPlanningApplications({ lat: 52.0, lng: -0.5 });
    expect(data.status).toBe('many');
  });

  it('reports status=none for an empty response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({ records: [], total: 0 }),
    );
    const data = await getPlanningApplications({ lat: 52.0, lng: -0.5 });
    expect(data.status).toBe('none');
  });
});

describe('getPricePaidHistory', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.fetch = vi.fn();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses SPARQL results into PriceSale records with the property-type URI tail', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({
        head: { vars: ['amount', 'date', 'paon', 'street', 'propertyType'] },
        results: {
          bindings: [
            {
              amount: { type: 'literal', value: '425000' },
              date: { type: 'literal', value: '2024-08-15' },
              paon: { type: 'literal', value: '10' },
              street: { type: 'literal', value: 'Example Road' },
              propertyType: {
                type: 'uri',
                value: 'http://landregistry.data.gov.uk/def/common/semi-detached',
              },
            },
          ],
        },
      }),
    );
    const data = await getPricePaidHistory('SG18 0AA');
    expect(data.sales).toHaveLength(1);
    expect(data.sales[0].amount).toBe(425000);
    expect(data.sales[0].propertyType).toBe('semi-detached');
    expect(data.averagePrice).toBe(425000);
    expect(data.latestSale?.amount).toBe(425000);
  });

  it('computes an average and latest across multiple sales', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({
        head: { vars: ['amount', 'date', 'paon', 'street', 'propertyType'] },
        results: {
          bindings: [
            {
              amount: { value: '400000' },
              date: { value: '2024-08-15' },
              paon: { value: '10' },
            },
            {
              amount: { value: '300000' },
              date: { value: '2022-01-10' },
              paon: { value: '12' },
            },
          ],
        },
      }),
    );
    const data = await getPricePaidHistory('SG18 0AA');
    expect(data.averagePrice).toBe(350000);
    expect(data.latestSale?.date).toBe('2024-08-15');
  });

  it('discards bindings with missing required fields', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({
        head: { vars: ['amount', 'date', 'paon'] },
        results: {
          bindings: [
            { amount: { value: '400000' }, date: { value: '2024-08-15' } }, // no paon
            { amount: { value: '0' }, date: { value: '2024-08-15' }, paon: { value: '1' } }, // zero
            { amount: { value: '425000' }, date: { value: '2024-08-15' }, paon: { value: '10' } },
          ],
        },
      }),
    );
    const data = await getPricePaidHistory('SG18 0AA');
    expect(data.sales).toHaveLength(1);
  });

  it('returns empty data when SPARQL returns no bindings', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockJsonResponse({ head: { vars: [] }, results: { bindings: [] } }),
    );
    const data = await getPricePaidHistory('SG18 0AA');
    expect(data.sales).toHaveLength(0);
    expect(data.averagePrice).toBeNull();
    expect(data.latestSale).toBeNull();
  });
});

describe('getPropertyIntelligence', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.fetch = vi.fn();
    mockLookupEpc.mockReset();
    mockLookupEpc.mockResolvedValue(null);
    mockGetTitleBoundary.mockReset();
    mockGetTitleBoundary.mockResolvedValue(null);
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns a full report with all sources OK', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(
        mockJsonResponse({
          status: 200,
          result: {
            postcode: 'SG18 0AA',
            latitude: 52.087,
            longitude: -0.275,
            admin_district: 'Central Bedfordshire',
            admin_ward: 'Biggleswade North',
            country: 'England',
            region: 'East of England',
          },
        }),
      )
      .mockResolvedValueOnce(mockJsonResponse({ items: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ records: [], total: 0 }))
      .mockResolvedValueOnce(mockJsonResponse({ head: { vars: [] }, results: { bindings: [] } }));

    const report = await getPropertyIntelligence('SG18 0AA');
    expect(report.location?.admin_district).toBe('Central Bedfordshire');
    expect(report.flood?.status).toBe('low');
    expect(report.heritage?.status).toBe('none');
    expect(report.article4?.status).toBe('none');
    expect(report.treePreservation?.status).toBe('none');
    expect(report.brownfield?.status).toBe('none');
    expect(report.localPlanningAuthority).toBeNull();
    expect(report.floodZone?.status).toBe('none');
    expect(report.environmental?.status).toBe('none');
    expect(report.planningApplications?.status).toBe('none');
    expect(report.pricePaid?.sales).toHaveLength(0);
    expect(report.epc).toBeNull();
    expect(report.valuePerSqm).toBeNull();
    expect(report.sources.every((s) => s.ok)).toBe(true);
    expect(report.sources.some((s) => s.source.includes('communities.gov.uk'))).toBe(true);
  });

  it('queries the planning datasets by polygon when a title boundary resolves', async () => {
    const wkt =
      'POLYGON((-0.135 51.5095, -0.133 51.5095, -0.133 51.5105, -0.135 51.5105, -0.135 51.5095))';
    mockGetTitleBoundary.mockResolvedValueOnce({
      inspireId: 7,
      geojson: {
        type: 'Polygon',
        coordinates: [
          [
            [-0.135, 51.5095],
            [-0.133, 51.5095],
            [-0.133, 51.5105],
            [-0.135, 51.5105],
            [-0.135, 51.5095],
          ],
        ],
      },
      wkt4326: wkt,
      // This path queries planning.data.gov.uk by WGS84 polygon and never uses
      // the BNG pair, but TitleBoundary carries it for the Groundsure path.
      wkt27700: null,
      areaSqMetres: null,
      bboxWkt4326: wkt,
      source: 'inspire-polygon',
    });
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(
        mockJsonResponse({
          status: 200,
          result: {
            postcode: 'SG18 0AA',
            latitude: 52.087,
            longitude: -0.275,
            admin_district: 'Central Bedfordshire',
            admin_ward: 'Biggleswade North',
            country: 'England',
            region: 'East of England',
          },
        }),
      )
      .mockResolvedValueOnce(mockJsonResponse({ uprn: '100021300679', latitude: 52.087, longitude: -0.275 })) // uprn-coordinate (precise pin)
      .mockResolvedValueOnce(mockJsonResponse({ items: [] })) // flood (EA)
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] })) // heritage
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] })) // article4
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] })) // floodZone
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] })) // environmental
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] })) // tpo
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] })) // brownfield
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] })) // lpa
      .mockResolvedValueOnce(mockJsonResponse({ records: [], total: 0 })) // planit
      .mockResolvedValueOnce(mockJsonResponse({ head: { vars: [] }, results: { bindings: [] } })); // sparql

    const report = await getPropertyIntelligence('SG18 0AA', undefined, '100021300679');

    expect(report.coordinateSource).toBe('os-open-uprn');
    expect(report.titleBoundary?.inspireId).toBe(7);
    expect(report.sources.some((s) => s.source === 'hmlr-inspire-polygon' && s.ok)).toBe(true);

    const planningCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.includes('planning.data.gov.uk'));
    expect(planningCalls.length).toBeGreaterThan(0);
    // every planning.data call went by polygon, none by bare point
    expect(
      planningCalls.every((u) => u.includes('geometry=') && u.includes('geometry_relation=intersects')),
    ).toBe(true);
    expect(planningCalls.some((u) => u.includes('latitude='))).toBe(false);
  });

  it('derives £/m² from the latest sale and the EPC floor area', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(
        mockJsonResponse({
          status: 200,
          result: {
            postcode: 'SG18 0AA',
            latitude: 52.087,
            longitude: -0.275,
            admin_district: 'Central Bedfordshire',
            admin_ward: 'Biggleswade North',
            country: 'England',
            region: 'East of England',
          },
        }),
      )
      .mockResolvedValueOnce(mockJsonResponse({ items: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ records: [], total: 0 }))
      .mockResolvedValueOnce(
        mockJsonResponse({
          head: { vars: ['amount', 'date', 'paon'] },
          results: {
            bindings: [{ amount: { value: '400000' }, date: { value: '2024-08-15' }, paon: { value: '86' } }],
          },
        }),
      );
    mockLookupEpc.mockResolvedValueOnce({
      address: '86 Fairfield Road, BIGGLESWADE',
      postcode: 'SG18 0AA',
      uprn: null,
      currentBand: 'C',
      potentialBand: 'B',
      currentRating: 69,
      potentialRating: 82,
      floorAreaSqm: 100,
      lodgementDate: '2023-06-13',
      meetsMees: true,
    });

    const report = await getPropertyIntelligence('SG18 0AA', '86 Fairfield Road');
    expect(report.epc?.currentBand).toBe('C');
    expect(report.epc?.floorAreaSqm).toBe(100);
    // 400,000 ÷ 100 = 4,000
    expect(report.valuePerSqm).toBe(4000);
    expect(mockLookupEpc).toHaveBeenCalledWith('SG18 0AA', { addressLine: '86 Fairfield Road' });
  });

  it('leaves £/m² null when EPC floor area is missing', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(
        mockJsonResponse({
          status: 200,
          result: {
            postcode: 'SG18 0AA',
            latitude: 52.087,
            longitude: -0.275,
            admin_district: 'Central Bedfordshire',
            admin_ward: 'Biggleswade North',
            country: 'England',
            region: 'East of England',
          },
        }),
      )
      .mockResolvedValueOnce(mockJsonResponse({ items: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ records: [], total: 0 }))
      .mockResolvedValueOnce(
        mockJsonResponse({
          head: { vars: ['amount', 'date', 'paon'] },
          results: {
            bindings: [{ amount: { value: '400000' }, date: { value: '2024-08-15' }, paon: { value: '86' } }],
          },
        }),
      );
    mockLookupEpc.mockResolvedValueOnce({
      address: '86 Fairfield Road, BIGGLESWADE',
      postcode: 'SG18 0AA',
      uprn: null,
      currentBand: 'C',
      potentialBand: null,
      currentRating: null,
      potentialRating: null,
      floorAreaSqm: null,
      lodgementDate: null,
      meetsMees: true,
    });

    const report = await getPropertyIntelligence('SG18 0AA');
    expect(report.epc?.currentBand).toBe('C');
    expect(report.valuePerSqm).toBeNull();
  });

  it('returns partial results when one source fails', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(
        mockJsonResponse({
          status: 200,
          result: {
            postcode: 'SG18 0AA',
            latitude: 52.087,
            longitude: -0.275,
            admin_district: 'Central Bedfordshire',
            admin_ward: 'Biggleswade North',
            country: 'England',
            region: 'East of England',
          },
        }),
      )
      .mockRejectedValueOnce(new Error('EA unreachable'))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ entities: [] }))
      .mockResolvedValueOnce(mockJsonResponse({ records: [], total: 0 }))
      .mockResolvedValueOnce(mockJsonResponse({ head: { vars: [] }, results: { bindings: [] } }));

    const report = await getPropertyIntelligence('SG18 0AA');
    expect(report.location).not.toBeNull();
    expect(report.flood).toBeNull();
    expect(report.heritage).not.toBeNull();
    const floodSource = report.sources.find((s) => s.source === 'environment.data.gov.uk/flood');
    expect(floodSource?.ok).toBe(false);
    expect(floodSource?.error).toContain('EA unreachable');
  });

  it('returns report with no location when postcode lookup fails', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('404'));
    const report = await getPropertyIntelligence('INVALID');
    expect(report.location).toBeNull();
    expect(report.flood).toBeNull();
    expect(report.heritage).toBeNull();
    expect(report.article4).toBeNull();
    expect(report.treePreservation).toBeNull();
    expect(report.brownfield).toBeNull();
    expect(report.localPlanningAuthority).toBeNull();
    expect(report.floodZone).toBeNull();
    expect(report.environmental).toBeNull();
    expect(report.planningApplications).toBeNull();
    expect(report.pricePaid).toBeNull();
    expect(report.coordinateSource).toBeNull();
    expect(report.sources[0].ok).toBe(false);
  });

  it('uses the exact OS Open UPRN pin (not the postcode centroid) when a UPRN is given', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      // 1. postcodes.io — a deliberately coarse centroid
      .mockResolvedValueOnce(
        mockJsonResponse({
          status: 200,
          result: {
            postcode: 'LL28 5NA',
            latitude: 53.2,
            longitude: -3.79,
            admin_district: 'Conwy',
            admin_ward: 'Llansanffraid',
            country: 'Wales',
            region: null,
          },
        }),
      )
      // 2. property-enrich /uprn-coordinate — the exact pin
      .mockResolvedValueOnce(
        mockJsonResponse({
          uprn: '100100437058',
          latitude: 53.2674149,
          longitude: -3.7949716,
          easting: 280384,
          northing: 375993,
          source: 'os-open-uprn',
        }),
      )
      // 3+. downstream coordinate/postcode sources — empty payloads cover every parser
      .mockResolvedValue(
        mockJsonResponse({ items: [], entities: [], records: [], total: 0, head: { vars: [] }, results: { bindings: [] } }),
      );

    const report = await getPropertyIntelligence('LL28 5NA', undefined, '100100437058');

    expect(report.coordinateSource).toBe('os-open-uprn');
    expect(report.location?.coordinates).toEqual({ lat: 53.2674149, lng: -3.7949716 });
    expect(report.sources.some((s) => s.source === 'os-open-uprn' && s.ok)).toBe(true);

    // The precise pin must flow downstream to the coordinate-keyed sources.
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('uprn-coordinate?uprn=100100437058'))).toBe(true);
    expect(urls.some((u) => u.includes('planning.data.gov.uk') && u.includes('latitude=53.2674149'))).toBe(true);
  });

  it('falls back to the postcode centroid when the UPRN is not in OS Open UPRN', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(
        mockJsonResponse({
          status: 200,
          result: {
            postcode: 'SG18 0AA',
            latitude: 52.087,
            longitude: -0.275,
            admin_district: 'Central Bedfordshire',
            admin_ward: 'Biggleswade North',
            country: 'England',
            region: 'East of England',
          },
        }),
      )
      // /uprn-coordinate 404 → UPRN not present
      .mockResolvedValueOnce(mockJsonResponse({ error: 'uprn not found' }, false, 404))
      .mockResolvedValue(
        mockJsonResponse({ items: [], entities: [], records: [], total: 0, head: { vars: [] }, results: { bindings: [] } }),
      );

    const report = await getPropertyIntelligence('SG18 0AA', undefined, '999999999999');
    expect(report.coordinateSource).toBe('postcode-centroid');
    expect(report.location?.coordinates).toEqual({ lat: 52.087, lng: -0.275 });
    expect(report.sources.some((s) => s.source === 'os-open-uprn' && !s.ok)).toBe(true);
  });
});

describe('getEpcCached', () => {
  const cert: import('../epc.service').EpcCertificate = {
    address: '20 Ivel Road, SANDY',
    postcode: 'SG19 1AX',
    uprn: '100080078747',
    currentBand: 'C',
    potentialBand: 'B',
    currentRating: 69,
    potentialRating: 82,
    floorAreaSqm: 93,
    lodgementDate: '2023-06-13',
    meetsMees: true,
  };

  beforeEach(() => {
    window.localStorage.clear();
    mockLookupEpc.mockReset();
  });

  it('should call the edge function once and serve repeat reads from cache', async () => {
    mockLookupEpc.mockResolvedValueOnce(cert);
    const first = await getEpcCached('SG19 1AX', '20 Ivel Road');
    // Different postcode spacing/case → same cache key
    const second = await getEpcCached('sg191ax', '20 Ivel Road');
    expect(first?.currentBand).toBe('C');
    expect(second?.currentBand).toBe('C');
    expect(mockLookupEpc).toHaveBeenCalledTimes(1);
  });

  it('should not cache a miss — the next call retries the edge function', async () => {
    mockLookupEpc.mockResolvedValueOnce(null).mockResolvedValueOnce(cert);
    expect(await getEpcCached('SG19 1AX')).toBeNull();
    expect((await getEpcCached('SG19 1AX'))?.currentBand).toBe('C');
    expect(mockLookupEpc).toHaveBeenCalledTimes(2);
  });

  it('should key the cache on the address line too — different dwellings do not collide', async () => {
    mockLookupEpc.mockResolvedValueOnce(cert).mockResolvedValueOnce({ ...cert, currentBand: 'D' });
    await getEpcCached('SG19 1AX', '20 Ivel Road');
    const other = await getEpcCached('SG19 1AX', '22 Ivel Road');
    expect(other?.currentBand).toBe('D');
    expect(mockLookupEpc).toHaveBeenCalledTimes(2);
  });
});
