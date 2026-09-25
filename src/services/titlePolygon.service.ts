// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Title-boundary resolver — point → registered title polygon.
 *
 * Calls the `inspire-title` Cloudflare Worker (VITE_TITLE_WORKER_URL), which does
 * a point-in-polygon over a FlatGeobuf of HM Land Registry's INSPIRE Index
 * Polygons (OGL) hosted on R2. The point is the property's precise OS Open UPRN
 * pin, so the polygon is the actual registered parcel.
 *
 * Returns null when no polygon covers the point — INSPIRE coverage is ~85–90%
 * (unregistered land, titles without INSPIRE boundaries) — or when the worker
 * isn't configured. Callers MUST fall back (e.g. the postcode-buffer box) and
 * treat this as indicative — INSPIRE boundaries are general "index" boundaries,
 * not a legal determination (that's the OC2 title plan).
 *
 * Attribution: anywhere a boundary derived from this is shown, display
 * "Contains HM Land Registry data © Crown copyright and database right 2026"
 * (OGL requirement).
 */

import type { Polygon, MultiPolygon, Position } from 'geojson';

import { logger } from '@/utils/logger';

export type TitleBoundarySource = 'inspire-polygon';

export interface TitleBoundary {
  /** Land Registry INSPIRE ID for the matched polygon (not the title number). */
  inspireId: number;
  /** Geometry in WGS84 — for the boundary map. */
  geojson: Polygon | MultiPolygon;
  /** WKT in WGS84 (EPSG:4326) — for the planning.data.gov.uk `geometry` query. */
  wkt4326: string;
  /** WKT in EPSG:27700 (British National Grid) — what Groundsure and PISCES take. */
  wkt27700: string | null;
  /** True parcel area in square metres, as PostGIS `ST_Area` would give it. */
  areaSqMetres: number | null;
  /** Axis-aligned bounding-box WKT in WGS84 — a tiny fallback when the full
   *  polygon WKT is too long for a GET query. */
  bboxWkt4326: string;
  source: TitleBoundarySource;
}

interface TitleWorkerResponse {
  inspireId: number | null;
  geometry: Polygon | MultiPolygon | null;
  wkt4326: string;
  /** Both added 2026-09-04 (monorepo #199) — optional, because a worker
   *  deployment that predates it answers without them and should degrade to the
   *  postcode box rather than throw. */
  wkt27700?: string | null;
  areaSqMetres?: number | null;
  source: TitleBoundarySource;
}

/** Walk a Polygon/MultiPolygon's coordinates and return [minLng, minLat, maxLng, maxLat]. */
function boundsOf(geom: Polygon | MultiPolygon): [number, number, number, number] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  const rings: Position[][] =
    geom.type === 'Polygon' ? geom.coordinates : geom.coordinates.flat();
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return [minLng, minLat, maxLng, maxLat];
}

function bboxWkt(geom: Polygon | MultiPolygon): string {
  const [minLng, minLat, maxLng, maxLat] = boundsOf(geom);
  return (
    `POLYGON((${minLng} ${minLat}, ${maxLng} ${minLat}, ` +
    `${maxLng} ${maxLat}, ${minLng} ${maxLat}, ${minLng} ${minLat}))`
  );
}

/**
 * Resolve the registered title boundary covering a WGS84 point via the
 * inspire-title Worker. Returns null when no polygon matches, the worker isn't
 * configured, or the lookup fails — never throws, so the caller can fall back
 * silently.
 */
export async function getTitleBoundary(lat: number, lng: number): Promise<TitleBoundary | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const base = import.meta.env.VITE_TITLE_WORKER_URL as string | undefined;
  if (!base) return null; // not configured → fall back to point-intersect

  let body: TitleWorkerResponse | null;
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/title?lat=${lat}&lng=${lng}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      logger.warn('getTitleBoundary: worker returned non-200', { status: res.status });
      return null;
    }
    body = (await res.json()) as TitleWorkerResponse | null;
  } catch (err) {
    logger.warn('getTitleBoundary: worker fetch failed', { err });
    return null;
  }

  if (!body || body.inspireId == null || !body.geometry) return null;

  return {
    inspireId: body.inspireId,
    geojson: body.geometry,
    wkt4326: body.wkt4326,
    wkt27700: body.wkt27700 ?? null,
    areaSqMetres: typeof body.areaSqMetres === 'number' ? body.areaSqMetres : null,
    bboxWkt4326: bboxWkt(body.geometry),
    source: 'inspire-polygon',
  };
}
