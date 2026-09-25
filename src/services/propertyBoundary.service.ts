// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Property boundary → WKT resolver.
 *
 * Groundsure (and OneSearch PISCES) want the property location as a Well-Known
 * Text POLYGON in EPSG:27700 (British National Grid eastings/northings). The
 * HMLR title plan is a raster image with no coordinates, so we can't feed it
 * directly.
 *
 * Source decision (card bbfdc386, option C): derive a small buffer box from the
 * postcode centroid. postcodes.io already returns BNG eastings/northings for a
 * postcode (free, cached in postcodeService), and Groundsure's environmental /
 * flood / planning / geo-risk reports are area-based — they need a location
 * footprint, not the exact registered boundary. A ~150m square around the
 * centroid is sufficient and matches the footprint-sized polygon Groundsure's
 * own documented example uses.
 *
 * SUPERSEDED where we hold polygons. `inspireBoundary.service.ts` now resolves
 * the property's own registered freehold parcel from HMLR INSPIRE Index Polygons
 * (free, OGL) by spatial containment of its OS Open UPRN pin, and falls back to
 * the box below only when that misses. The postcode-centroid path in this file is
 * the last resort in that chain and is unchanged.
 *
 * Remaining upgrade path:
 *  - A: HMLR National Polygon Service — exact registered boundary by title
 *    number, and the only source that covers a leasehold demise. Paid.
 * All slot in behind the same WKT output, so callers don't change.
 *
 * NOTE: `bngPolygonToWkt` mirrors the monorepo worker helper
 * (packages/groundsure-rest/src/wkt.js). They live in separate repos and can't
 * share an import; keep the two in sync if the WKT shape ever changes.
 */

import { postcodeService } from './postcodeService';
import { logger } from '@/utils/logger';

/** A point in British National Grid (EPSG:27700) eastings/northings, metres. */
export interface BngPoint {
  easting: number;
  northing: number;
}

/**
 * How the boundary was derived, best first. `resolvePropertyBoundary` walks
 * these in order and degrades quietly:
 *  - 'inspire-polygon'   the property's own registered freehold parcel
 *  - 'uprn-centroid'     a box on the UPRN pin (right house, square shape)
 *  - 'postcode-centroid' a box on the postcode centroid (may miss the house)
 */
export type BoundarySource = 'inspire-polygon' | 'uprn-centroid' | 'postcode-centroid';

/** Result of resolving a property to a WKT polygon. */
export interface ResolvedBoundary {
  /** WKT POLYGON in EPSG:27700, ready for groundsureService / onesearchService. */
  wkt: string;
  /** The point the boundary was built around (BNG). For 'inspire-polygon' this is
   *  the UPRN pin that selected the parcel, not the parcel's own centroid. */
  centre: BngPoint;
  /** Half the side length of the square box, in metres. Null for
   *  'inspire-polygon', where the WKT is a real outline and no box was drawn. */
  halfSizeMetres: number | null;
  /** How the boundary was derived. */
  source: BoundarySource;
  /** INSPIRE parcel id — set only when source is 'inspire-polygon'. */
  inspireId?: number;
  /** Parcel area in m² — set only when source is 'inspire-polygon'. */
  areaSqMetres?: number;
}

/**
 * Default half-side for the buffer box, in metres. 35m → a 70m square = 0.49 ha.
 *
 * WHY 35 AND NOT 75. At 75m the box is 150m square = 2.25 ha, which exceeds the
 * 1 ha maximum search area on four of Groundsure's residential products —
 * Homescreen, Homebuyers, Planning and Flood, including the two cheapest bundles
 * the panel leads with. Their pricing API answered `price: null`,
 * `invalid_reason: "needs_estimate"` for all four while the 15 ha products
 * (Avista, Enviro All-in-One, CON29M) priced fine. Confirmed live 2026-08-29 and
 * confirmed as the cause by Marek Lukowski (Groundsure) on 2026-09-01: a WKT
 * larger than every price band returns needs_estimate.
 *
 * He also confirmed the API picks the price tier from the WKT area itself, so a
 * smaller box reaches the cheaper tiers rather than needing one requested — which
 * is what makes Cheshire Salt's 0.03 ha tier reachable at all.
 *
 * WHAT THIS DOES NOT FIX. The box is centred on the POSTCODE CENTROID, not the
 * property, so shrinking it makes it likelier to miss the actual house on a long
 * street. Marek's answer to "what polygon do your other resellers send" was that
 * they send a property-specific site outline — drawn on a map, or taken from the
 * paid Land Registry polygon dataset. Nobody sends a centroid box. So this buys
 * ORDERABILITY, not accuracy, and Marc accepted that trade on 2026-09-01.
 *
 * THE REAL FIX, now cheaper than it was. HM Land Registry began publishing UPRN
 * and INSPIRE ID lookups against Price Paid Data on 2026-08-28, and INSPIRE Index
 * Polygons are free per-council downloads under OGL — a property-specific outline
 * without paying for the National Polygon dataset. That is the upgrade path named
 * below, and it is the one to build.
 */
export const DEFAULT_HALF_SIZE_METRES = 35;

/**
 * Build a closed WKT POLYGON from a ring of British National Grid points. The
 * ring is auto-closed (first point repeated) if the caller didn't close it.
 *
 * @throws if fewer than 3 points or any point has non-finite coordinates.
 */
export function bngPolygonToWkt(points: BngPoint[]): string {
  if (points.length < 3) {
    throw new Error('bngPolygonToWkt: need at least 3 points');
  }
  for (const p of points) {
    if (!Number.isFinite(p.easting) || !Number.isFinite(p.northing)) {
      throw new Error('bngPolygonToWkt: each point needs finite easting and northing');
    }
  }

  const ring = [...points];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first.easting !== last.easting || first.northing !== last.northing) {
    ring.push(first);
  }

  const coords = ring.map((p) => `${p.easting} ${p.northing}`).join(', ');
  return `POLYGON((${coords}))`;
}

/**
 * Build a square WKT POLYGON centred on a BNG point. Corners are walked
 * SW → SE → NE → NW and auto-closed by bngPolygonToWkt.
 *
 * @throws if the centre is non-finite or halfSizeMetres is not a positive number.
 */
export function pointToBufferWkt(
  centre: BngPoint,
  halfSizeMetres: number = DEFAULT_HALF_SIZE_METRES,
): string {
  if (!Number.isFinite(centre.easting) || !Number.isFinite(centre.northing)) {
    throw new Error('pointToBufferWkt: centre needs finite easting and northing');
  }
  if (!Number.isFinite(halfSizeMetres) || halfSizeMetres <= 0) {
    throw new Error('pointToBufferWkt: halfSizeMetres must be a positive number');
  }

  const { easting: e, northing: n } = centre;
  const h = halfSizeMetres;
  const corners: BngPoint[] = [
    { easting: e - h, northing: n - h }, // SW
    { easting: e + h, northing: n - h }, // SE
    { easting: e + h, northing: n + h }, // NE
    { easting: e - h, northing: n + h }, // NW
  ];
  return bngPolygonToWkt(corners);
}

/**
 * Resolve a postcode to a WKT polygon via its BNG centroid. Returns null when
 * the postcode is unknown to postcodes.io or has no grid reference (e.g. some
 * non-geographic / overseas-forces postcodes carry null eastings/northings).
 */
export async function resolveBoundaryFromPostcode(
  postcode: string,
  halfSizeMetres: number = DEFAULT_HALF_SIZE_METRES,
): Promise<ResolvedBoundary | null> {
  const trimmed = postcode?.trim();
  if (!trimmed) return null;

  let result;
  try {
    result = await postcodeService.lookupPostcode(trimmed);
  } catch (err) {
    logger.warn('resolveBoundaryFromPostcode: postcode lookup failed', { postcode: trimmed, err });
    return null;
  }

  if (!result || result.eastings == null || result.northings == null) {
    logger.warn('resolveBoundaryFromPostcode: no grid reference for postcode', { postcode: trimmed });
    return null;
  }

  const centre: BngPoint = { easting: result.eastings, northing: result.northings };
  return {
    wkt: pointToBufferWkt(centre, halfSizeMetres),
    centre,
    halfSizeMetres,
    source: 'postcode-centroid',
  };
}
