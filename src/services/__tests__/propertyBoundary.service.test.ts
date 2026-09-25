import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  bngPolygonToWkt,
  pointToBufferWkt,
  resolveBoundaryFromPostcode,
  DEFAULT_HALF_SIZE_METRES,
  type BngPoint,
} from '../propertyBoundary.service';
import { postcodeService } from '../postcodeService';

// postcodeService wraps postcodes.io; mock it so the resolver tests don't hit
// the network and we can drive the eastings/northings directly.
vi.mock('../postcodeService', () => ({
  postcodeService: { lookupPostcode: vi.fn() },
}));
const mockLookup = vi.mocked(postcodeService.lookupPostcode);

describe('bngPolygonToWkt', () => {
  it('should build a closed POLYGON from a ring of BNG points', () => {
    // Arrange
    const ring: BngPoint[] = [
      { easting: 531062, northing: 104078 },
      { easting: 531068, northing: 104078 },
      { easting: 531068, northing: 104075 },
    ];
    // Act
    const wkt = bngPolygonToWkt(ring);
    // Assert — first point repeated at the end to close the ring
    expect(wkt).toBe(
      'POLYGON((531062 104078, 531068 104078, 531068 104075, 531062 104078))',
    );
  });

  it('should not duplicate the closing point when the ring is already closed', () => {
    // Arrange
    const closed: BngPoint[] = [
      { easting: 0, northing: 0 },
      { easting: 10, northing: 0 },
      { easting: 10, northing: 10 },
      { easting: 0, northing: 0 },
    ];
    // Act
    const wkt = bngPolygonToWkt(closed);
    // Assert
    expect(wkt).toBe('POLYGON((0 0, 10 0, 10 10, 0 0))');
  });

  it('should throw when given fewer than 3 points', () => {
    expect(() =>
      bngPolygonToWkt([
        { easting: 0, northing: 0 },
        { easting: 1, northing: 1 },
      ]),
    ).toThrow(/at least 3 points/);
  });

  it('should throw when a point has a non-finite coordinate', () => {
    expect(() =>
      bngPolygonToWkt([
        { easting: 0, northing: 0 },
        { easting: Number.NaN, northing: 1 },
        { easting: 2, northing: 2 },
      ]),
    ).toThrow(/finite easting and northing/);
  });
});

describe('pointToBufferWkt', () => {
  it('should build a square box centred on the point, walked SW→SE→NE→NW and closed', () => {
    // Arrange
    const centre: BngPoint = { easting: 1000, northing: 2000 };
    // Act
    const wkt = pointToBufferWkt(centre, 50);
    // Assert
    expect(wkt).toBe(
      'POLYGON((950 1950, 1050 1950, 1050 2050, 950 2050, 950 1950))',
    );
  });

  it('should use the default half-size when none is provided', () => {
    // Arrange
    const centre: BngPoint = { easting: 0, northing: 0 };
    const h = DEFAULT_HALF_SIZE_METRES;
    // Act
    const wkt = pointToBufferWkt(centre);
    // Assert
    expect(wkt).toBe(
      `POLYGON((${-h} ${-h}, ${h} ${-h}, ${h} ${h}, ${-h} ${h}, ${-h} ${-h}))`,
    );
  });

  it('should keep the default box under Groundsure’s 1 ha maximum search area', () => {
    // The whole reason the default is 35 and not 75. At 75m the box is 150m
    // square = 2.25 ha, over the 1 ha cap on Homescreen, Homebuyers, Planning and
    // Flood — all four came back price: null, needs_estimate, confirmed by
    // Marek Lukowski (Groundsure) 2026-09-01. A future tweak that pushes the
    // default back over 1 ha silently unsells the two cheapest bundles.
    const sideMetres = DEFAULT_HALF_SIZE_METRES * 2;
    const hectares = (sideMetres * sideMetres) / 10000;

    expect(hectares).toBeLessThan(1);
  });

  it('should throw when the centre has a non-finite coordinate', () => {
    expect(() =>
      pointToBufferWkt({ easting: Number.POSITIVE_INFINITY, northing: 0 }),
    ).toThrow(/finite easting and northing/);
  });

  it('should throw when half-size is zero or negative', () => {
    const centre: BngPoint = { easting: 0, northing: 0 };
    expect(() => pointToBufferWkt(centre, 0)).toThrow(/positive number/);
    expect(() => pointToBufferWkt(centre, -10)).toThrow(/positive number/);
  });
});

describe('resolveBoundaryFromPostcode', () => {
  beforeEach(() => {
    mockLookup.mockReset();
  });

  function postcodeResult(eastings: number | null, northings: number | null) {
    // Only the fields the resolver reads; cast through unknown to satisfy the
    // full PostcodeResult shape without restating ~40 unused properties.
    return { postcode: 'BN1 1HW', eastings, northings } as unknown as Awaited<
      ReturnType<typeof postcodeService.lookupPostcode>
    >;
  }

  it('should resolve a postcode with a grid reference to a buffer-box WKT', async () => {
    // Arrange
    mockLookup.mockResolvedValueOnce(postcodeResult(531065, 104077));
    // Act
    const resolved = await resolveBoundaryFromPostcode('BN1 1HW', 75);
    // Assert
    expect(resolved).not.toBeNull();
    expect(resolved?.centre).toEqual({ easting: 531065, northing: 104077 });
    expect(resolved?.halfSizeMetres).toBe(75);
    expect(resolved?.source).toBe('postcode-centroid');
    expect(resolved?.wkt).toBe(
      'POLYGON((530990 104002, 531140 104002, 531140 104152, 530990 104152, 530990 104002))',
    );
  });

  it('should return null when the postcode is unknown to postcodes.io', async () => {
    // Arrange
    mockLookup.mockResolvedValueOnce(null);
    // Act
    const resolved = await resolveBoundaryFromPostcode('ZZ99 9ZZ');
    // Assert
    expect(resolved).toBeNull();
  });

  it('should return null when the postcode has no grid reference', async () => {
    // Arrange — some non-geographic postcodes carry null eastings/northings
    mockLookup.mockResolvedValueOnce(postcodeResult(null, null));
    // Act
    const resolved = await resolveBoundaryFromPostcode('BN1 1HW');
    // Assert
    expect(resolved).toBeNull();
  });

  it('should return null for an empty or whitespace postcode without hitting the API', async () => {
    // Act
    const resolved = await resolveBoundaryFromPostcode('   ');
    // Assert
    expect(resolved).toBeNull();
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it('should return null when the postcode lookup throws', async () => {
    // Arrange
    mockLookup.mockRejectedValueOnce(new Error('network down'));
    // Act
    const resolved = await resolveBoundaryFromPostcode('BN1 1HW');
    // Assert
    expect(resolved).toBeNull();
  });
});
