// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Three free, keyless, CORS-open ground and water checks for the property
 * report, each a single point query. All three are Open Government Licence
 * data, and each source asks to be acknowledged; the report names them.
 *
 * - Surface water flood risk: Environment Agency NaFRA2 "Risk of Flooding from
 *   Surface Water" WMS, layer `rofsw`. Queried on British National Grid,
 *   which is the one reference system its GetFeatureInfo reliably answers.
 *   Its gateway blocks bursts of requests, so results are cached.
 *   Outside every mapped risk polygon the EA classes the risk as very low.
 * - Coal mining: Mining Remediation Authority (formerly the Coal Authority)
 *   Development High Risk Area. Inside one, a mining search is needed. Outside
 *   one does not mean outside the coalfield, so the copy never says "no risk".
 * - Radon: BGS / UKHSA Indicative Atlas of Radon v3. Gives the HIGHEST class
 *   anywhere in the surrounding 1 km grid square, not the home itself.
 */

import { readCache, writeCache } from './intelCache';

/** A point carrying its British National Grid position where one is known. */
export interface GroundPoint {
  lat: number;
  lng: number;
  easting?: number;
  northing?: number;
}

export type SurfaceWaterBand = 'high' | 'medium' | 'low' | 'very_low';

export interface SurfaceWaterRisk {
  band: SurfaceWaterBand;
  /** EA confidence score for the mapped band, when one was returned. */
  confidence: number | null;
}

export interface CoalMiningRisk {
  inHighRiskArea: boolean;
}

export interface RadonRisk {
  /** 1 (lowest) to 6 (highest) radon potential class, max across the 1 km square. */
  classMax: 1 | 2 | 3 | 4 | 5 | 6;
  /** The atlas's own plain-English sentence for the square. */
  description: string;
  /** OS 1 km grid reference of the square, e.g. TL1749. */
  gridSquare: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const TTL_MS = { surfaceWater: 30 * DAY_MS, coal: 30 * DAY_MS, radon: 90 * DAY_MS };

const SURFACE_WATER_WMS =
  'https://environment.data.gov.uk/spatialdata/nafra2-risk-of-flooding-from-surface-water/wms';
const COAL_HIGH_RISK_QUERY =
  'https://services-eu1.arcgis.com/Qn4lKcPDVHNivEyr/arcgis/rest/services/DevelopmentHighRiskArea/FeatureServer/0/query';
const RADON_QUERY = 'https://map.bgs.ac.uk/arcgis/rest/services/GeoIndex_Onshore/radon/MapServer/0/query';

/** Half-width of the surface-water query box, in metres. 101 px over 200 m ≈ 2 m a pixel. */
const SURFACE_WATER_HALF_BOX_M = 100;

const BAND_BY_LABEL: Record<string, SurfaceWaterBand> = {
  high: 'high',
  medium: 'medium',
  low: 'low',
  'very low': 'very_low',
};

async function getJson<T>(url: string, source: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${source} returned ${response.status}`);
  return (await response.json()) as T;
}

interface WmsFeatureInfo {
  features?: Array<{ properties?: { risk_band?: string; confidence?: number } }>;
}

export async function getSurfaceWaterRisk(point: GroundPoint): Promise<SurfaceWaterRisk> {
  const { easting, northing } = point;
  if (typeof easting !== 'number' || typeof northing !== 'number') {
    throw new Error('No British National Grid position for this address');
  }
  const e = Math.round(easting);
  const n = Math.round(northing);
  const cacheKey = `rofsw:${e},${n}`;
  const cached = readCache<SurfaceWaterRisk>(cacheKey);
  if (cached) return cached;

  const h = SURFACE_WATER_HALF_BOX_M;
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetFeatureInfo',
    LAYERS: 'rofsw',
    QUERY_LAYERS: 'rofsw',
    SRS: 'EPSG:27700',
    BBOX: `${e - h},${n - h},${e + h},${n + h}`,
    WIDTH: '101',
    HEIGHT: '101',
    X: '50',
    Y: '50',
    INFO_FORMAT: 'application/json',
    FEATURE_COUNT: '1',
    // Without this the reply carries the full polygon geometry (~170 KB).
    propertyName: 'risk_band,confidence',
  });
  const body = await getJson<WmsFeatureInfo>(`${SURFACE_WATER_WMS}?${params}`, 'Environment Agency surface water');
  const props = body.features?.[0]?.properties;
  const band = props?.risk_band ? BAND_BY_LABEL[props.risk_band.trim().toLowerCase()] : 'very_low';
  if (!band) throw new Error(`Unrecognised surface water band: ${props?.risk_band}`);

  const result: SurfaceWaterRisk = {
    band,
    confidence: typeof props?.confidence === 'number' ? props.confidence : null,
  };
  writeCache(cacheKey, result, TTL_MS.surfaceWater);
  return result;
}

interface ArcGisQuery<A> {
  features?: Array<{ attributes: A }>;
  error?: { message?: string };
}

function arcGisPointQuery(base: string, point: GroundPoint, outFields: string): string {
  const params = new URLSearchParams({
    geometry: `${point.lng},${point.lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    returnGeometry: 'false',
    outFields,
    f: 'json',
  });
  return `${base}?${params}`;
}

/** ArcGIS reports query errors in a 200 body, so a missing `features` array is a failure. */
function featuresOf<A>(body: ArcGisQuery<A>, source: string): Array<{ attributes: A }> {
  if (body.error || !Array.isArray(body.features)) {
    throw new Error(`${source}: ${body.error?.message ?? 'unexpected response'}`);
  }
  return body.features;
}

export async function getCoalMiningRisk(point: GroundPoint): Promise<CoalMiningRisk> {
  const cacheKey = `coal:${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;
  const cached = readCache<CoalMiningRisk>(cacheKey);
  if (cached) return cached;

  const body = await getJson<ArcGisQuery<{ FID: number }>>(
    arcGisPointQuery(COAL_HIGH_RISK_QUERY, point, 'FID'),
    'Mining Remediation Authority',
  );
  const result: CoalMiningRisk = { inHighRiskArea: featuresOf(body, 'Mining Remediation Authority').length > 0 };
  writeCache(cacheKey, result, TTL_MS.coal);
  return result;
}

interface RadonAttributes {
  CLASS_MAX?: number;
  Description?: string;
  TILE?: string;
}

/** Returns null outside the atlas's coverage (no 1 km square at the point). */
export async function getRadonRisk(point: GroundPoint): Promise<RadonRisk | null> {
  const cacheKey = `radon:${point.lat.toFixed(4)},${point.lng.toFixed(4)}`;
  const cached = readCache<RadonRisk>(cacheKey);
  if (cached) return cached;

  const body = await getJson<ArcGisQuery<RadonAttributes>>(
    arcGisPointQuery(RADON_QUERY, point, 'CLASS_MAX,Description,TILE'),
    'BGS radon',
  );
  const attrs = featuresOf(body, 'BGS radon')[0]?.attributes;
  const cls = attrs?.CLASS_MAX;
  if (!attrs || typeof cls !== 'number' || cls < 1 || cls > 6) return null;

  const result: RadonRisk = {
    classMax: cls as RadonRisk['classMax'],
    description: attrs.Description ?? '',
    gridSquare: attrs.TILE ?? '',
  };
  writeCache(cacheKey, result, TTL_MS.radon);
  return result;
}
