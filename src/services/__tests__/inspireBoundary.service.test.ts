import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  resolvePropertyBoundary,
  lookupInspireParcel,
  MAX_PARCEL_AREA_SQ_METRES,
  MIN_PARCEL_AREA_SQ_METRES,
} from '../inspireBoundary.service';
import { postcodeService } from '../postcodeService';
import { getTitleBoundary } from '../titlePolygon.service';
import { supabase } from '@/lib/supabase';

// The resolver now takes two steps: one RPC for the property's own pin, then
// the inspire-title Worker for the parcel covering it. Mock both, plus the
// postcode fallback, so the chain can be driven a step at a time.
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('../postcodeService', () => ({
  postcodeService: { lookupPostcode: vi.fn() },
}));
vi.mock('../titlePolygon.service', () => ({ getTitleBoundary: vi.fn() }));

const mockRpc = vi.mocked(supabase.rpc);
const mockLookup = vi.mocked(postcodeService.lookupPostcode);
const mockTitle = vi.mocked(getTitleBoundary);

/** SG19 1EX, Marc's test postcode (Central Bedfordshire). */
const POSTCODE = 'SG19 1EX';
const POSTCODE_POINT = { eastings: 516530, northings: 249228 };

/** UPRN 100080079058 and parcel 34556521 as they exist in the live store. */
const REAL_UPRN = '100080079058';
const REAL_PARCEL_WKT =
  'POLYGON((516577.48 249212.37,516577.61 249206.22,516603.05 249204.26,' +
  '516603.69 249209.86,516594.18 249210.77,516587.19 249211.44,516577.48 249212.37))';

/**
 * That UPRN's pin exactly as public.resolve_uprn_point returns it — the grid
 * reference from OS Open UPRN and the WGS84 pair PostGIS derives from it.
 */
const PIN = {
  easting: 516590,
  northing: 249208,
  lat: 52.128890037823,
  lng: -0.298196777302174,
};

const pointRow = (overrides: Partial<typeof PIN> = {}) => ({ ...PIN, ...overrides });

/** What the Worker gives back for a parcel covering that pin. */
function parcel(overrides: Record<string, unknown> = {}) {
  return {
    inspireId: 34556521,
    geojson: { type: 'Polygon', coordinates: [[]] },
    wkt4326: 'POLYGON((-0.2982 52.1288, -0.2981 52.1288, -0.2982 52.1288))',
    wkt27700: REAL_PARCEL_WKT,
    areaSqMetres: 152.2848,
    bboxWkt4326: 'POLYGON((-0.2982 52.1288, -0.2981 52.1288, -0.2982 52.1288))',
    source: 'inspire-polygon',
    ...overrides,
  };
}

/** A closed square of the given side, centred on the UPRN pin. */
function squareWkt(sideMetres: number): string {
  const h = sideMetres / 2;
  const e = PIN.easting;
  const n = PIN.northing;
  return (
    `POLYGON((${e - h} ${n - h},${e + h} ${n - h},` +
    `${e + h} ${n + h},${e - h} ${n + h},${e - h} ${n - h}))`
  );
}

/** Both halves answering: the pin is known and a parcel covers it. */
function givenParcel(overrides: Record<string, unknown> = {}) {
  mockRpc.mockResolvedValue({ data: [pointRow()], error: null } as never);
  mockTitle.mockResolvedValue(parcel(overrides) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLookup.mockResolvedValue(POSTCODE_POINT as never);
  mockTitle.mockResolvedValue(null as never);
});

describe('resolvePropertyBoundary — the INSPIRE path', () => {
  it("should return source 'inspire-polygon' with the parcel WKT when the parcel is a sane size", async () => {
    // Arrange
    givenParcel();
    // Act
    const result = await resolvePropertyBoundary({ uprn: REAL_UPRN, postcode: POSTCODE });
    // Assert
    expect(result).not.toBeNull();
    expect(result?.source).toBe('inspire-polygon');
    expect(result?.wkt).toBe(REAL_PARCEL_WKT);
    expect(result?.inspireId).toBe(34556521);
    expect(result?.areaSqMetres).toBe(152.2848);
    // A real outline is not a box, so there is no half-size to report.
    expect(result?.halfSizeMetres).toBeNull();
  });

  it('should return a parcel whose area is under the 1 ha Groundsure cap', async () => {
    // Arrange
    givenParcel();
    // Act
    const result = await resolvePropertyBoundary({ uprn: REAL_UPRN, postcode: POSTCODE });
    // Assert — this is the whole point: it must price on the 1 ha products.
    expect(result?.areaSqMetres).toBeLessThan(MAX_PARCEL_AREA_SQ_METRES);
  });

  it('should pass the UPRN through to the RPC as p_uprn', async () => {
    // Arrange
    givenParcel();
    // Act
    await resolvePropertyBoundary({ uprn: `  ${REAL_UPRN}  `, postcode: POSTCODE });
    // Assert — trimmed, so stray whitespace from a listing never misses.
    expect(mockRpc).toHaveBeenCalledWith('resolve_uprn_point', { p_uprn: REAL_UPRN });
  });

  // The Worker takes WGS84 and the rest of this module works in BNG, so getting
  // this the wrong way round would look up a point in the North Sea.
  it("should ask the Worker for the pin's lat/lng, not its grid reference", async () => {
    // Arrange
    givenParcel();
    // Act
    await resolvePropertyBoundary({ uprn: REAL_UPRN, postcode: POSTCODE });
    // Assert
    expect(mockTitle).toHaveBeenCalledWith(PIN.lat, PIN.lng);
  });

  // Groundsure and PISCES take British National Grid. The Worker returns both
  // projections and sending the wrong one would be accepted and priced.
  it('should send the BNG outline onward, never the WGS84 one', async () => {
    // Arrange
    givenParcel();
    // Act
    const result = await resolvePropertyBoundary({ uprn: REAL_UPRN, postcode: POSTCODE });
    // Assert
    expect(result?.wkt).toBe(REAL_PARCEL_WKT);
    expect(result?.wkt).not.toContain('-0.29');
  });
});

describe('resolvePropertyBoundary — the 1 ha ceiling', () => {
  it("should fall back to 'uprn-centroid' when the parcel is larger than 1 ha", async () => {
    // Arrange — a 200m square = 4 ha, the shape of a real rural freehold.
    const fourHectares = 200 * 200;
    expect(fourHectares).toBeGreaterThan(MAX_PARCEL_AREA_SQ_METRES);
    givenParcel({ wkt27700: squareWkt(200), areaSqMetres: fourHectares });
    // Act
    const result = await resolvePropertyBoundary({ uprn: REAL_UPRN, postcode: POSTCODE });
    // Assert — the oversized parcel is dropped, but we keep the right centre.
    expect(result?.source).toBe('uprn-centroid');
    expect(result?.centre).toEqual({ easting: PIN.easting, northing: PIN.northing });
    expect(result?.wkt).not.toBe(squareWkt(200));
    expect(result?.halfSizeMetres).toBe(35);
  });

  it('should accept a parcel of exactly 1 ha', async () => {
    // Arrange — the cap is inclusive; 1 ha still prices.
    givenParcel({ areaSqMetres: MAX_PARCEL_AREA_SQ_METRES });
    // Act
    const result = await resolvePropertyBoundary({ uprn: REAL_UPRN, postcode: POSTCODE });
    // Assert
    expect(result?.source).toBe('inspire-polygon');
  });
});

describe('resolvePropertyBoundary — the sliver floor', () => {
  it("should fall back to 'uprn-centroid' when the parcel is a sliver under 20 m2", async () => {
    // Arrange — a 3m square = 9 m2: an access strip, not a house plot. It would
    // price happily and then assess almost nothing.
    givenParcel({ wkt27700: squareWkt(3), areaSqMetres: 9 });
    // Act
    const result = await resolvePropertyBoundary({ uprn: REAL_UPRN, postcode: POSTCODE });
    // Assert
    expect(result?.source).toBe('uprn-centroid');
  });

  it('should accept a parcel of exactly the minimum area', async () => {
    // Arrange
    givenParcel({ areaSqMetres: MIN_PARCEL_AREA_SQ_METRES });
    // Act
    const result = await resolvePropertyBoundary({ uprn: REAL_UPRN, postcode: POSTCODE });
    // Assert
    expect(result?.source).toBe('inspire-polygon');
  });
});

describe('resolvePropertyBoundary — degrading down the chain', () => {
  it("should fall back to 'uprn-centroid' when the UPRN is known but no parcel covers it", async () => {
    // Arrange — unregistered land, or a point INSPIRE simply has no polygon for.
    mockRpc.mockResolvedValue({ data: [pointRow()], error: null } as never);
    mockTitle.mockResolvedValue(null as never);
    // Act
    const result = await resolvePropertyBoundary({ uprn: REAL_UPRN, postcode: POSTCODE });
    // Assert
    expect(result?.source).toBe('uprn-centroid');
    expect(result?.centre).toEqual({ easting: PIN.easting, northing: PIN.northing });
  });

  // The store this replaces returned no WKT for a parcel in several pieces,
  // because a MULTIPOLYGON site outline has never been tested against
  // Groundsure. Going national is not the moment to start.
  it("should fall back to 'uprn-centroid' for a multi-part parcel", async () => {
    // Arrange
    givenParcel({
      geojson: { type: 'MultiPolygon', coordinates: [[[]], [[]]] },
      wkt27700: 'MULTIPOLYGON(((0 0,1 0,1 1,0 0)),((5 5,6 5,6 6,5 5)))',
    });
    // Act
    const result = await resolvePropertyBoundary({ uprn: REAL_UPRN, postcode: POSTCODE });
    // Assert
    expect(result?.source).toBe('uprn-centroid');
  });

  it('should treat a single-part MultiPolygon as an ordinary parcel', async () => {
    // Arrange — one piece wrapped in a MultiPolygon is still one outline, and
    // the old store accepted it (ST_NumGeometries = 1).
    givenParcel({ geojson: { type: 'MultiPolygon', coordinates: [[[]]] } });
    // Act
    const result = await resolvePropertyBoundary({ uprn: REAL_UPRN, postcode: POSTCODE });
    // Assert
    expect(result?.source).toBe('inspire-polygon');
  });

  // A Worker deployment predating monorepo #199 answers without wkt27700. That
  // is not a reason to send Groundsure a WGS84 outline it would accept and price.
  it("should fall back to 'uprn-centroid' when the Worker returns no BNG outline", async () => {
    // Arrange
    givenParcel({ wkt27700: null });
    // Act
    const result = await resolvePropertyBoundary({ uprn: REAL_UPRN, postcode: POSTCODE });
    // Assert
    expect(result?.source).toBe('uprn-centroid');
  });

  it("should fall back to 'uprn-centroid' when the Worker returns no area to gate on", async () => {
    // Arrange — without an area the 1 ha ceiling cannot fire, and sending an
    // ungated outline is how a third of orders came back needs_estimate.
    givenParcel({ areaSqMetres: null });
    // Act
    const result = await resolvePropertyBoundary({ uprn: REAL_UPRN, postcode: POSTCODE });
    // Assert
    expect(result?.source).toBe('uprn-centroid');
  });

  it("should fall back to 'postcode-centroid' when the UPRN is unknown to the store", async () => {
    // Arrange — RPC returns no rows at all.
    mockRpc.mockResolvedValue({ data: [], error: null } as never);
    // Act
    const result = await resolvePropertyBoundary({ uprn: '999999999999', postcode: POSTCODE });
    // Assert
    expect(result?.source).toBe('postcode-centroid');
    expect(result?.centre).toEqual({ easting: 516530, northing: 249228 });
  });

  it('should never call the Worker when the pin is unknown', async () => {
    // Arrange — no point, nothing to look a parcel up with.
    mockRpc.mockResolvedValue({ data: [], error: null } as never);
    // Act
    await resolvePropertyBoundary({ uprn: '999999999999', postcode: POSTCODE });
    // Assert
    expect(mockTitle).not.toHaveBeenCalled();
  });

  it("should fall back to 'postcode-centroid' and never call the RPC when there is no UPRN", async () => {
    // Act
    const result = await resolvePropertyBoundary({ uprn: null, postcode: POSTCODE });
    // Assert — a listing with no EPC UPRN behaves exactly as it does today.
    expect(result?.source).toBe('postcode-centroid');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("should fall back to 'postcode-centroid' when the RPC returns an error", async () => {
    // Arrange
    mockRpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } } as never);
    // Act
    const result = await resolvePropertyBoundary({ uprn: REAL_UPRN, postcode: POSTCODE });
    // Assert
    expect(result?.source).toBe('postcode-centroid');
  });

  it('should not throw when the RPC itself rejects', async () => {
    // Arrange — a network failure must not fail an order the postcode can serve.
    mockRpc.mockRejectedValue(new Error('network down'));
    // Act
    const result = await resolvePropertyBoundary({ uprn: REAL_UPRN, postcode: POSTCODE });
    // Assert
    expect(result?.source).toBe('postcode-centroid');
  });

  it("should degrade to 'uprn-centroid', not the postcode, when the Worker rejects", async () => {
    // Arrange — getTitleBoundary is documented never to throw, but the chain
    // must not depend on that. A worker outage costs the outline; it must not
    // also cost the address, because the postcode centroid can be next door.
    mockRpc.mockResolvedValue({ data: [pointRow()], error: null } as never);
    mockTitle.mockRejectedValue(new Error('worker down'));
    // Act
    const result = await resolvePropertyBoundary({ uprn: REAL_UPRN, postcode: POSTCODE });
    // Assert
    expect(result?.source).toBe('uprn-centroid');
    expect(result?.centre).toEqual({ easting: PIN.easting, northing: PIN.northing });
  });

  it('should return null only when the postcode will not resolve either', async () => {
    // Arrange
    mockRpc.mockResolvedValue({ data: [], error: null } as never);
    mockLookup.mockResolvedValue(null as never);
    // Act
    const result = await resolvePropertyBoundary({ uprn: REAL_UPRN, postcode: 'ZZ99 9ZZ' });
    // Assert
    expect(result).toBeNull();
  });

  it('should honour a caller-supplied halfSizeMetres on the fallback box', async () => {
    // Arrange
    mockRpc.mockResolvedValue({ data: [], error: null } as never);
    // Act
    const result = await resolvePropertyBoundary({
      uprn: null,
      postcode: POSTCODE,
      halfSizeMetres: 50,
    });
    // Assert
    expect(result?.halfSizeMetres).toBe(50);
  });
});

describe('lookupInspireParcel', () => {
  it('should return null for an empty UPRN without calling the RPC', async () => {
    // Act
    const result = await lookupInspireParcel('   ');
    // Assert
    expect(result).toBeNull();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('should return null when the row carries a non-finite grid reference', async () => {
    // Arrange
    mockRpc.mockResolvedValue({
      data: [pointRow({ easting: Number.NaN })],
      error: null,
    } as never);
    // Act
    const result = await lookupInspireParcel(REAL_UPRN);
    // Assert
    expect(result).toBeNull();
  });

  it('should return the pin with no parcel rather than null when the Worker finds nothing', async () => {
    // Arrange — this distinction IS the uprn-centroid rung of the chain.
    mockRpc.mockResolvedValue({ data: [pointRow()], error: null } as never);
    mockTitle.mockResolvedValue(null as never);
    // Act
    const result = await lookupInspireParcel(REAL_UPRN);
    // Assert
    expect(result).not.toBeNull();
    expect(result?.centre).toEqual({ easting: PIN.easting, northing: PIN.northing });
    expect(result?.inspireId).toBeNull();
    expect(result?.boundaryWkt).toBeNull();
  });
});
