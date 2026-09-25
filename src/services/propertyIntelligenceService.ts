// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * v3 Property Intelligence service (Ship 3a — MVP).
 *
 * Aggregates free UK property-data APIs keyed on a postcode. This is the
 * skeleton ship — two sources wired:
 *
 *   - Postcodes.io (geocoding postcode → lat/lng)
 *   - Environment Agency Flood Monitoring API (current warnings near location)
 *
 * Future ships will add: EA Flood Zones 2/3, Historic England (listed
 * buildings + conservation areas), Natural England (SSSIs, AONBs), planning
 * data (planning.data.gov.uk + UK PlanIt), Land Registry price paid.
 *
 * Caching: localStorage with per-source TTL (postcode 30d, warnings 15min).
 * Errors on any single API are non-fatal — report partial results.
 *
 * See docs/Upgrades/propxchain-v3-roadmap.md Phase 3.
 */

import { lookupEpc, type EpcCertificate } from './epc.service';
import { getTitleBoundary, type TitleBoundary } from './titlePolygon.service';

export type { EpcCertificate, EpcBand } from './epc.service';
export type { TitleBoundary } from './titlePolygon.service';

const STORAGE_PREFIX = 'propxchain:pi:';

/**
 * Max length of a polygon WKT we'll put in a planning.data.gov.uk GET query
 * before falling back to its bounding box, to stay clear of URL-length limits.
 */
const MAX_GEOMETRY_WKT_LENGTH = 1500;

/** property-enrich service holding the OS Open UPRN gazetteer (precise pin). */
const PROPERTY_ENRICH_BASE = 'https://propxchain-property-enrich.onrender.com';

const TTL_MS = {
  postcode: 30 * 24 * 60 * 60 * 1000,
  // A UPRN's coordinate is effectively permanent — cache it as long as a postcode.
  uprnCoordinate: 30 * 24 * 60 * 60 * 1000,
  floodWarnings: 15 * 60 * 1000,
  planningData: 24 * 60 * 60 * 1000,
  planningApplications: 24 * 60 * 60 * 1000,
  pricePaid: 7 * 24 * 60 * 60 * 1000,
  // EPC certificates change only on re-lodgement — cache like price-paid.
  // Previously the EPC leg was the report's only uncached source, so the
  // auto-scan pre-warm re-hit the rate-limited edge fn on every tab open.
  epc: 7 * 24 * 60 * 60 * 1000,
} as const;

// ============================================
// Public types
// ============================================

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface PostcodeInfo {
  postcode: string;
  coordinates: Coordinates;
  admin_district: string;
  admin_ward: string;
  country: string;
  region: string | null;
}

export type FloodSeverity = 'severe_warning' | 'warning' | 'alert' | 'no_longer_in_force';

export interface FloodWarning {
  description: string;
  severity: FloodSeverity;
  severityLevel: 1 | 2 | 3 | 4;
  timeRaised: string;
  area: string;
  sourceUrl: string;
}

export interface FloodRiskData {
  activeWarnings: FloodWarning[];
  /** Rough indicator: 'low' when no active warnings, else 'medium' or 'high' */
  status: 'low' | 'medium' | 'high' | 'unknown';
}

export interface PlanningEntity {
  entity: number;
  name: string;
  dataset: string;
  reference: string;
  startDate: string | null;
  documentUrl: string | null;
  /** Human-readable detail where the dataset carries one (e.g. an Article 4 direction's scope). */
  detail?: string | null;
  /** Listed-building grade (I, II*, II) where present. */
  grade?: string | null;
}

export interface HeritageData {
  listedBuildings: PlanningEntity[];
  conservationAreas: PlanningEntity[];
  /** Scheduled monuments intersecting the point (nationally important archaeology). */
  scheduledMonuments?: PlanningEntity[];
  /** World Heritage Sites (and buffer zones) intersecting the point. */
  worldHeritageSites?: PlanningEntity[];
  /** Summary status across heritage categories */
  status: 'none' | 'in_conservation_area' | 'listed_building' | 'both';
}

export interface Article4Data {
  directions: PlanningEntity[];
  /**
   * 'none' = full permitted-development rights; 'restricted' = one or more
   * Article 4 directions remove PD rights here — the headline flag for any
   * buyer planning works. Indicative only; the official local search is
   * authoritative.
   */
  status: 'none' | 'restricted';
}

export interface TreePreservationData {
  zones: PlanningEntity[];
  /** 'present' = a Tree Preservation Order zone applies — consent needed to fell/prune. */
  status: 'none' | 'present';
}

export interface BrownfieldData {
  sites: PlanningEntity[];
  /** 'present' = on a brownfield (previously-developed) land register entry. */
  status: 'none' | 'present';
}

export interface FloodZoneData {
  zones: PlanningEntity[];
  /** Summary: the most severe zone found */
  status: 'none' | 'zone_2' | 'zone_3' | 'zone_present';
}

export interface EnvironmentalData {
  designations: PlanningEntity[];
  /** Whether the property sits in any designated environmental area */
  status: 'none' | 'single' | 'multiple';
}

export interface PlanningApplication {
  uid: string;
  reference: string;
  description: string;
  /** Application state — "Approved", "Refused", "Pending", "Withdrawn", etc. */
  appState: string;
  address: string;
  startDate: string | null;
  decidedDate: string | null;
  /** Distance from query coordinates in metres */
  distanceM: number;
  url: string;
}

export interface PlanningApplicationsData {
  applications: PlanningApplication[];
  total: number;
  status: 'none' | 'some' | 'many';
}

export interface PriceSale {
  /** Amount paid in GBP */
  amount: number;
  /** ISO date string YYYY-MM-DD */
  date: string;
  /** Primary address number/name */
  paon: string;
  street: string | null;
  propertyType: string | null;
}

export interface PricePaidData {
  sales: PriceSale[];
  /** Average sale price across returned records, or null if none */
  averagePrice: number | null;
  /** Highest-date record from the returned set, or null */
  latestSale: PriceSale | null;
}

export interface SourceStatus {
  source: string;
  ok: boolean;
  error?: string;
  lastFetched: number;
}

export interface PropertyIntelligenceReport {
  postcode: string;
  fetchedAt: number;
  location: PostcodeInfo | null;
  /**
   * Provenance of `location.coordinates`: the property's exact OS Open UPRN
   * point (when a UPRN resolved) or the coarser postcode centroid. Null when no
   * location resolved. The precise pin makes every coordinate-keyed source
   * (flood, heritage, planning, the map) point-accurate.
   */
  coordinateSource: 'os-open-uprn' | 'postcode-centroid' | null;
  /**
   * Registered title boundary (HMLR INSPIRE Index Polygon) covering the precise
   * pin, when one exists. When present, the planning datasets below were queried
   * by polygon intersection (catching designations the bare point would miss);
   * null means coverage gap → point-intersect was used. Indicative general
   * boundary, not a legal determination.
   */
  titleBoundary: TitleBoundary | null;
  flood: FloodRiskData | null;
  heritage: HeritageData | null;
  /** Article 4 directions (permitted-development restrictions) intersecting the property. */
  article4: Article4Data | null;
  /** Tree Preservation Order zones intersecting the property. */
  treePreservation: TreePreservationData | null;
  floodZone: FloodZoneData | null;
  environmental: EnvironmentalData | null;
  /** Brownfield (previously-developed) land register entries intersecting the property. */
  brownfield: BrownfieldData | null;
  planningApplications: PlanningApplicationsData | null;
  pricePaid: PricePaidData | null;
  epc: EpcCertificate | null;
  /** Local planning authority for the property — routing hint for the official search. Null if unknown. */
  localPlanningAuthority: PlanningEntity | null;
  /**
   * Estimated price per square metre, derived from the most recent postcode
   * sale ÷ this property's EPC floor area. Null unless both are available.
   * A rough indicator, not a valuation — the sale and the EPC dwelling may
   * differ unless the address matched.
   */
  valuePerSqm: number | null;
  sources: SourceStatus[];
}

// ============================================
// Cache helpers
// ============================================

interface CachedEnvelope<T> {
  value: T;
  storedAt: number;
  ttlMs: number;
}

function readCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as CachedEnvelope<T>;
    if (Date.now() - envelope.storedAt > envelope.ttlMs) {
      window.localStorage.removeItem(STORAGE_PREFIX + key);
      return null;
    }
    return envelope.value;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T, ttlMs: number): void {
  if (typeof window === 'undefined') return;
  try {
    const envelope: CachedEnvelope<T> = { value, storedAt: Date.now(), ttlMs };
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(envelope));
  } catch {
    // localStorage quota exceeded or blocked — silently ignore, caching is best-effort
  }
}

// ============================================
// Postcodes.io — geocoding
// ============================================

interface PostcodesIoResponse {
  status: number;
  result?: {
    postcode: string;
    latitude: number;
    longitude: number;
    admin_district: string;
    admin_ward: string;
    country: string;
    region: string | null;
  };
  error?: string;
}

export async function getPostcodeInfo(postcode: string): Promise<PostcodeInfo> {
  const normalized = postcode.trim().replace(/\s+/g, '').toUpperCase();
  if (!normalized) {
    throw new Error('Postcode is empty');
  }

  const cacheKey = `postcode:${normalized}`;
  const cached = readCache<PostcodeInfo>(cacheKey);
  if (cached) return cached;

  const url = `https://api.postcodes.io/postcodes/${encodeURIComponent(normalized)}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Postcodes.io returned ${response.status}`);
  }
  const body = (await response.json()) as PostcodesIoResponse;
  if (body.status !== 200 || !body.result) {
    throw new Error(body.error ?? `Postcodes.io status ${body.status}`);
  }

  const info: PostcodeInfo = {
    postcode: body.result.postcode,
    coordinates: { lat: body.result.latitude, lng: body.result.longitude },
    admin_district: body.result.admin_district,
    admin_ward: body.result.admin_ward,
    country: body.result.country,
    region: body.result.region,
  };
  writeCache(cacheKey, info, TTL_MS.postcode);
  return info;
}

// ============================================
// OS Open UPRN — precise pin (via property-enrich)
// ============================================

interface UprnCoordinateResponse {
  uprn: string;
  latitude: number;
  longitude: number;
  easting: number;
  northing: number;
  source: string;
}

/**
 * Resolve a UPRN to its exact OS Open UPRN coordinate via the property-enrich
 * service. Returns null when the UPRN isn't in the dataset (404) or the input is
 * malformed; throws only on an unexpected service error so the caller can record
 * provenance. The coordinate is effectively permanent, so it's cached long.
 */
export async function getUprnCoordinate(uprn: string): Promise<Coordinates | null> {
  const normalized = uprn.trim();
  if (!/^\d{1,12}$/.test(normalized)) return null;

  const cacheKey = `uprn:${normalized}`;
  const cached = readCache<Coordinates>(cacheKey);
  if (cached) return cached;

  const url = `${PROPERTY_ENRICH_BASE}/uprn-coordinate?uprn=${encodeURIComponent(normalized)}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (response.status === 404) return null; // UPRN not present in OS Open UPRN
  if (!response.ok) {
    throw new Error(`property-enrich /uprn-coordinate returned ${response.status}`);
  }
  const body = (await response.json()) as UprnCoordinateResponse;
  if (typeof body.latitude !== 'number' || typeof body.longitude !== 'number') return null;

  const coords: Coordinates = { lat: body.latitude, lng: body.longitude };
  writeCache(cacheKey, coords, TTL_MS.uprnCoordinate);
  return coords;
}

// ============================================
// Environment Agency Flood Monitoring
// ============================================

interface EaFloodItem {
  description: string;
  severity: string;
  severityLevel: number;
  timeRaised: string;
  floodArea?: { description: string; localAuthority?: string };
  floodAreaID?: string;
  '@id'?: string;
}

interface EaFloodResponse {
  items: EaFloodItem[];
}

const SEVERITY_MAP: Record<string, FloodSeverity> = {
  'Severe Flood Warning': 'severe_warning',
  'Flood Warning': 'warning',
  'Flood Alert': 'alert',
  'Warning no Longer in Force': 'no_longer_in_force',
};

function severityLevelToStatus(maxLevel: number): FloodRiskData['status'] {
  if (maxLevel <= 0) return 'low';
  if (maxLevel === 1) return 'high';       // Severe flood warning
  if (maxLevel === 2) return 'high';       // Flood warning
  if (maxLevel === 3) return 'medium';     // Flood alert
  return 'low';                            // No longer in force
}

/**
 * Fetch active flood warnings near coordinates. Radius is in kilometres.
 * Returns an empty list (status: 'low') when there are no active warnings —
 * which is the overwhelmingly common case.
 */
export async function getFloodRisk(coords: Coordinates, radiusKm: number = 10): Promise<FloodRiskData> {
  const cacheKey = `flood:${coords.lat.toFixed(3)},${coords.lng.toFixed(3)}:${radiusKm}`;
  const cached = readCache<FloodRiskData>(cacheKey);
  if (cached) return cached;

  const url =
    `https://environment.data.gov.uk/flood-monitoring/id/floods` +
    `?lat=${encodeURIComponent(coords.lat)}&long=${encodeURIComponent(coords.lng)}&dist=${encodeURIComponent(radiusKm)}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Environment Agency returned ${response.status}`);
  }
  const body = (await response.json()) as EaFloodResponse;
  const items = Array.isArray(body.items) ? body.items : [];

  const activeWarnings: FloodWarning[] = items.map((item) => ({
    description: item.description,
    severity: SEVERITY_MAP[item.severity] ?? 'alert',
    severityLevel: Math.min(4, Math.max(1, item.severityLevel)) as 1 | 2 | 3 | 4,
    timeRaised: item.timeRaised,
    area: item.floodArea?.description ?? 'Unknown area',
    sourceUrl: item['@id'] ?? 'https://environment.data.gov.uk/flood-monitoring/',
  }));

  // Ignore warnings that are no longer in force for the status calc
  const liveLevels = activeWarnings
    .filter((w) => w.severity !== 'no_longer_in_force')
    .map((w) => w.severityLevel);
  const maxLevel = liveLevels.length > 0 ? Math.min(...liveLevels) : 0;
  const status = severityLevelToStatus(maxLevel);

  const result: FloodRiskData = { activeWarnings, status };
  writeCache(cacheKey, result, TTL_MS.floodWarnings);
  return result;
}

// ============================================
// planning.data.gov.uk — heritage + flood zones
// ============================================

interface PlanningDataEntity {
  entity?: number;
  name?: string;
  dataset?: string;
  reference?: string;
  'start-date'?: string;
  'document-url'?: string;
  description?: string;
  'listed-building-grade'?: string;
}

interface PlanningDataResponse {
  entities?: PlanningDataEntity[];
  count?: number;
}

function normalizePlanningEntity(raw: PlanningDataEntity): PlanningEntity {
  return {
    entity: Number(raw.entity ?? 0),
    name: String(raw.name ?? 'Unnamed'),
    dataset: String(raw.dataset ?? ''),
    reference: String(raw.reference ?? ''),
    startDate: raw['start-date'] ? String(raw['start-date']) : null,
    documentUrl: raw['document-url'] ? String(raw['document-url']) : null,
    detail: raw.description ? String(raw.description) : null,
    grade: raw['listed-building-grade'] ? String(raw['listed-building-grade']) : null,
  };
}

/**
 * Query planning.data.gov.uk for entities across one or more datasets.
 *
 * When `geometryWkt` is given (a WGS84 polygon — the registered title boundary),
 * the query intersects that polygon, catching designations that overlap the
 * parcel but not its centre point (e.g. a listed building the bare point misses).
 * Otherwise it falls back to point-intersect on the coordinate. Returns an empty
 * array if none match.
 */
async function getPlanningDataEntities(
  coords: Coordinates,
  datasets: string[],
  cacheKeyPrefix: string,
  geometryWkt?: string,
): Promise<PlanningEntity[]> {
  // coords still identify the property (so the cache key is stable); the mode
  // marker distinguishes a polygon query from a point query for the same point.
  const mode = geometryWkt ? 'geom' : 'pt';
  const cacheKey = `${cacheKeyPrefix}:${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}:${mode}:${datasets.join(',')}`;
  const cached = readCache<PlanningEntity[]>(cacheKey);
  if (cached) return cached;

  const datasetParams = datasets.map((d) => `dataset=${encodeURIComponent(d)}`).join('&');
  const locationParams = geometryWkt
    ? `geometry=${encodeURIComponent(geometryWkt)}&geometry_relation=intersects`
    : `latitude=${encodeURIComponent(coords.lat)}&longitude=${encodeURIComponent(coords.lng)}`;
  const url =
    `https://www.planning.data.gov.uk/entity.json` +
    `?${locationParams}` +
    `&${datasetParams}&limit=50`;

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`planning.data.gov.uk returned ${response.status}`);
  }
  const body = (await response.json()) as PlanningDataResponse;
  const entities = Array.isArray(body.entities) ? body.entities.map(normalizePlanningEntity) : [];
  writeCache(cacheKey, entities, TTL_MS.planningData);
  return entities;
}

export async function getHeritageAssets(
  coords: Coordinates,
  geometryWkt?: string,
): Promise<HeritageData> {
  const entities = await getPlanningDataEntities(
    coords,
    [
      'listed-building',
      'conservation-area',
      'scheduled-monument',
      'world-heritage-site',
      'world-heritage-site-buffer-zone',
    ],
    'heritage',
    geometryWkt,
  );
  const listedBuildings = entities.filter((e) => e.dataset === 'listed-building');
  const conservationAreas = entities.filter((e) => e.dataset === 'conservation-area');
  const scheduledMonuments = entities.filter((e) => e.dataset === 'scheduled-monument');
  const worldHeritageSites = entities.filter(
    (e) => e.dataset === 'world-heritage-site' || e.dataset === 'world-heritage-site-buffer-zone',
  );

  // Listed buildings, scheduled monuments and WHS are all high-significance
  // designations (works require consent); conservation areas are a step below.
  const highSignificance =
    listedBuildings.length > 0 || scheduledMonuments.length > 0 || worldHeritageSites.length > 0;
  const hasConservation = conservationAreas.length > 0;
  let status: HeritageData['status'] = 'none';
  if (highSignificance && hasConservation) status = 'both';
  else if (highSignificance) status = 'listed_building';
  else if (hasConservation) status = 'in_conservation_area';

  return { listedBuildings, conservationAreas, scheduledMonuments, worldHeritageSites, status };
}

/**
 * Query planning.data.gov.uk for Article 4 directions intersecting the point.
 * An Article 4 direction removes some permitted-development rights — the single
 * most decision-relevant planning flag for a buyer who intends to extend or
 * alter. Indicative intel only; the official local search is authoritative.
 */
export async function getArticle4Directions(
  coords: Coordinates,
  geometryWkt?: string,
): Promise<Article4Data> {
  const directions = await getPlanningDataEntities(
    coords,
    ['article-4-direction-area'],
    'article4',
    geometryWkt,
  );
  return { directions, status: directions.length > 0 ? 'restricted' : 'none' };
}

/**
 * Tree Preservation Order zones intersecting the point. A TPO means consent is
 * needed to fell, top or lop the protected trees — a CON29 enquiry. Indicative
 * only; the official local search is authoritative.
 */
export async function getTreePreservation(
  coords: Coordinates,
  geometryWkt?: string,
): Promise<TreePreservationData> {
  const zones = await getPlanningDataEntities(coords, ['tree-preservation-zone'], 'tpo', geometryWkt);
  return { zones, status: zones.length > 0 ? 'present' : 'none' };
}

/**
 * Brownfield (previously-developed) land register entries intersecting the
 * point. Indicative of development history / possible remediation context, not
 * a contamination assessment.
 */
export async function getBrownfield(
  coords: Coordinates,
  geometryWkt?: string,
): Promise<BrownfieldData> {
  const sites = await getPlanningDataEntities(
    coords,
    ['brownfield-land', 'brownfield-site'],
    'brownfield',
    geometryWkt,
  );
  return { sites, status: sites.length > 0 ? 'present' : 'none' };
}

/**
 * The local planning authority whose area contains the point — a routing hint
 * for ordering the official local search. Returns the first match, or null.
 */
export async function getLocalPlanningAuthority(
  coords: Coordinates,
  geometryWkt?: string,
): Promise<PlanningEntity | null> {
  const lpas = await getPlanningDataEntities(coords, ['local-planning-authority'], 'lpa', geometryWkt);
  return lpas[0] ?? null;
}

const ENVIRONMENTAL_DATASETS = [
  'green-belt',
  'site-of-special-scientific-interest',
  'area-of-outstanding-natural-beauty',
  'national-park',
  'ancient-woodland',
];

export async function getEnvironmentalDesignations(
  coords: Coordinates,
  geometryWkt?: string,
): Promise<EnvironmentalData> {
  const designations = await getPlanningDataEntities(
    coords,
    ENVIRONMENTAL_DATASETS,
    'environmental',
    geometryWkt,
  );
  let status: EnvironmentalData['status'] = 'none';
  if (designations.length === 1) status = 'single';
  else if (designations.length > 1) status = 'multiple';
  return { designations, status };
}

export async function getFloodZone(
  coords: Coordinates,
  geometryWkt?: string,
): Promise<FloodZoneData> {
  const zones = await getPlanningDataEntities(coords, ['flood-risk-zone'], 'floodzone', geometryWkt);

  // planning.data.gov.uk's flood-risk-zone entities encode the zone in the
  // `name` or `reference` field. Do a best-effort text match — favour zone 3.
  let status: FloodZoneData['status'] = 'none';
  if (zones.length > 0) {
    const text = zones.map((z) => `${z.name} ${z.reference}`.toLowerCase()).join(' ');
    if (text.includes('zone 3') || text.includes('flood zone 3')) status = 'zone_3';
    else if (text.includes('zone 2') || text.includes('flood zone 2')) status = 'zone_2';
    else status = 'zone_present';
  }
  return { zones, status };
}

// ============================================
// UK PlanIt — planning applications
// ============================================

interface PlanItRecord {
  uid?: string;
  reference?: string;
  description?: string;
  app_state?: string;
  address?: string;
  start_date?: string;
  decided_date?: string;
  distance?: number;
  url?: string;
  link?: string;
}

interface PlanItResponse {
  records?: PlanItRecord[];
  total?: number;
}

function normalizePlanItRecord(raw: PlanItRecord): PlanningApplication {
  return {
    uid: String(raw.uid ?? ''),
    reference: String(raw.reference ?? 'Unknown'),
    description: String(raw.description ?? '').trim(),
    appState: String(raw.app_state ?? 'Unknown'),
    address: String(raw.address ?? ''),
    startDate: raw.start_date ? String(raw.start_date) : null,
    decidedDate: raw.decided_date ? String(raw.decided_date) : null,
    distanceM: Math.round(Number(raw.distance ?? 0) * 1000),
    url: String(raw.url ?? raw.link ?? ''),
  };
}

/**
 * Fetch recent planning applications within a small radius of the
 * coordinates. Default radius 300m, limit 20 — enough to surface
 * neighbour activity without dumping every historical application.
 */
export async function getPlanningApplications(
  coords: Coordinates,
  radiusKm: number = 0.3,
  limit: number = 20,
): Promise<PlanningApplicationsData> {
  const cacheKey = `planit:${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}:${radiusKm}:${limit}`;
  const cached = readCache<PlanningApplicationsData>(cacheKey);
  if (cached) return cached;

  const url =
    `https://www.planit.org.uk/api/applics/json` +
    `?lat=${encodeURIComponent(coords.lat)}` +
    `&lng=${encodeURIComponent(coords.lng)}` +
    `&krad=${encodeURIComponent(radiusKm)}` +
    `&pg_sz=${encodeURIComponent(limit)}`;

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`UK PlanIt returned ${response.status}`);
  }
  const body = (await response.json()) as PlanItResponse;
  const records = Array.isArray(body.records) ? body.records.map(normalizePlanItRecord) : [];
  const total = Number(body.total ?? records.length);

  let status: PlanningApplicationsData['status'] = 'none';
  if (total >= 6) status = 'many';
  else if (total > 0) status = 'some';

  const result: PlanningApplicationsData = { applications: records, total, status };
  writeCache(cacheKey, result, TTL_MS.planningApplications);
  return result;
}

// ============================================
// Land Registry — price paid (SPARQL)
// ============================================

interface SparqlLiteral {
  type?: string;
  value?: string;
}

interface SparqlBinding {
  amount?: SparqlLiteral;
  date?: SparqlLiteral;
  paon?: SparqlLiteral;
  street?: SparqlLiteral;
  propertyType?: SparqlLiteral;
}

interface SparqlResponse {
  head?: { vars: string[] };
  results?: { bindings?: SparqlBinding[] };
}

function sparqlValue(lit: SparqlLiteral | undefined): string | null {
  const v = lit?.value;
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function buildPricePaidQuery(postcode: string): string {
  return `
PREFIX ppd: <http://landregistry.data.gov.uk/def/ppi/>
PREFIX lrcommon: <http://landregistry.data.gov.uk/def/common/>
SELECT ?amount ?date ?paon ?street ?propertyType WHERE {
  ?transx ppd:pricePaid ?amount ;
          ppd:transactionDate ?date ;
          ppd:propertyAddress ?addr ;
          ppd:propertyType ?propertyType .
  ?addr lrcommon:postcode "${postcode}" ;
        lrcommon:paon ?paon .
  OPTIONAL { ?addr lrcommon:street ?street }
}
ORDER BY DESC(?date)
LIMIT 25`.trim();
}

/**
 * Fetch recent Land Registry price-paid transactions for a postcode.
 * Uses the landregistry.data.gov.uk SPARQL endpoint with JSON output.
 * Properties on the postcode will typically be ~1–10 addresses; the
 * returned sales are most-recent-first.
 */
export async function getPricePaidHistory(postcode: string): Promise<PricePaidData> {
  const normalized = postcode.trim().toUpperCase();
  const cacheKey = `price:${normalized}`;
  const cached = readCache<PricePaidData>(cacheKey);
  if (cached) return cached;

  const query = buildPricePaidQuery(normalized);
  const url = `https://landregistry.data.gov.uk/landregistry/query?query=${encodeURIComponent(query)}&output=json`;
  const response = await fetch(url, { headers: { Accept: 'application/sparql-results+json' } });
  if (!response.ok) {
    throw new Error(`Land Registry SPARQL returned ${response.status}`);
  }
  const body = (await response.json()) as SparqlResponse;
  const bindings = body.results?.bindings ?? [];

  const sales: PriceSale[] = bindings
    .map((b) => {
      const amount = Number(sparqlValue(b.amount));
      const date = sparqlValue(b.date);
      const paon = sparqlValue(b.paon);
      if (!Number.isFinite(amount) || amount <= 0 || !date || !paon) return null;
      // Property type comes back as a URI like http://...#terraced — take the tail
      const typeUri = sparqlValue(b.propertyType);
      const typeTail = typeUri ? typeUri.split(/[/#]/).pop() ?? null : null;
      return {
        amount,
        date: date.slice(0, 10),
        paon,
        street: sparqlValue(b.street),
        propertyType: typeTail,
      } satisfies PriceSale;
    })
    .filter((s): s is PriceSale => s !== null);

  const averagePrice =
    sales.length > 0 ? Math.round(sales.reduce((a, s) => a + s.amount, 0) / sales.length) : null;
  const latestSale =
    sales.length > 0
      ? sales.reduce((latest, s) => (s.date > latest.date ? s : latest), sales[0])
      : null;

  const result: PricePaidData = { sales, averagePrice, latestSale };
  writeCache(cacheKey, result, TTL_MS.pricePaid);
  return result;
}

/**
 * Cached wrapper around the EPC edge-function lookup. Certificates only
 * change on re-lodgement, and the underlying function is IP-rate-limited
 * (30 req/5min), so hits are cached; misses are NOT cached — a null can be
 * a transient upstream failure and should retry on the next report.
 * Exported for unit testing.
 */
export async function getEpcCached(
  postcode: string,
  addressLine?: string,
): Promise<EpcCertificate | null> {
  const cacheKey = `epc:${postcode.trim().toUpperCase().replace(/\s+/g, '')}:${(addressLine ?? '').trim().toLowerCase()}`;
  const cached = readCache<EpcCertificate>(cacheKey);
  if (cached) return cached;
  const epc = await lookupEpc(postcode, { addressLine });
  if (epc) writeCache(cacheKey, epc, TTL_MS.epc);
  return epc;
}

// ============================================
// Aggregate report
// ============================================

export async function getPropertyIntelligence(
  postcode: string,
  addressLine?: string,
  uprn?: string,
): Promise<PropertyIntelligenceReport> {
  const fetchedAt = Date.now();
  const sources: SourceStatus[] = [];

  let location: PostcodeInfo | null = null;
  try {
    location = await getPostcodeInfo(postcode);
    sources.push({ source: 'postcodes.io', ok: true, lastFetched: Date.now() });
  } catch (err) {
    sources.push({
      source: 'postcodes.io',
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      lastFetched: Date.now(),
    });
  }

  // Precise pin: when a UPRN is known, replace the postcode centroid with the
  // property's exact OS Open UPRN point so every coordinate-keyed source below
  // (flood, heritage, planning, the map) is point-accurate. Postcode-keyed
  // sources (price-paid, EPC) are unaffected. Falls back silently to the centroid
  // when there's no UPRN, the service is down, or the UPRN isn't in the dataset.
  let coordinateSource: PropertyIntelligenceReport['coordinateSource'] =
    location ? 'postcode-centroid' : null;
  if (location && uprn) {
    try {
      const precise = await getUprnCoordinate(uprn);
      if (precise) {
        location = { ...location, coordinates: precise };
        coordinateSource = 'os-open-uprn';
        sources.push({ source: 'os-open-uprn', ok: true, lastFetched: Date.now() });
      } else {
        sources.push({ source: 'os-open-uprn', ok: false, error: 'UPRN not found', lastFetched: Date.now() });
      }
    } catch (err) {
      sources.push({
        source: 'os-open-uprn',
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        lastFetched: Date.now(),
      });
    }
  }

  let flood: FloodRiskData | null = null;
  let heritage: HeritageData | null = null;
  let article4: Article4Data | null = null;
  let treePreservation: TreePreservationData | null = null;
  let floodZone: FloodZoneData | null = null;
  let environmental: EnvironmentalData | null = null;
  let brownfield: BrownfieldData | null = null;
  let planningApplications: PlanningApplicationsData | null = null;
  let pricePaid: PricePaidData | null = null;
  let epc: EpcCertificate | null = null;
  let localPlanningAuthority: PlanningEntity | null = null;
  let titleBoundary: TitleBoundary | null = null;

  if (location) {
    // Registered title boundary (HMLR INSPIRE) at the precise pin. When present,
    // the planning datasets are queried by polygon intersection instead of the
    // bare point — catching designations that overlap the parcel (e.g. a listed
    // building the centroid misses). Non-fatal: any failure → point-intersect.
    //
    // Only resolve on the precise OS Open UPRN pin: a postcode centroid can sit
    // in next-door's parcel, which would pull the wrong title polygon and query
    // the wrong extent. Without a UPRN we stay on point-intersect.
    let planningGeometry: string | undefined;
    if (coordinateSource === 'os-open-uprn') {
      try {
        titleBoundary = await getTitleBoundary(location.coordinates.lat, location.coordinates.lng);
        if (titleBoundary) {
          planningGeometry =
            titleBoundary.wkt4326.length <= MAX_GEOMETRY_WKT_LENGTH
              ? titleBoundary.wkt4326
              : titleBoundary.bboxWkt4326;
          sources.push({ source: 'hmlr-inspire-polygon', ok: true, lastFetched: Date.now() });
        }
      } catch (err) {
        sources.push({
          source: 'hmlr-inspire-polygon',
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          lastFetched: Date.now(),
        });
      }
    }

    // Fetch the downstream sources in parallel — none depend on each other
    const [
      floodRes,
      heritageRes,
      article4Res,
      floodZoneRes,
      envRes,
      tpoRes,
      brownfieldRes,
      lpaRes,
      planningRes,
      priceRes,
      epcRes,
    ] = await Promise.allSettled([
      getFloodRisk(location.coordinates),
      getHeritageAssets(location.coordinates, planningGeometry),
      getArticle4Directions(location.coordinates, planningGeometry),
      getFloodZone(location.coordinates, planningGeometry),
      getEnvironmentalDesignations(location.coordinates, planningGeometry),
      getTreePreservation(location.coordinates, planningGeometry),
      getBrownfield(location.coordinates, planningGeometry),
      getLocalPlanningAuthority(location.coordinates, planningGeometry),
      getPlanningApplications(location.coordinates),
      getPricePaidHistory(location.postcode),
      getEpcCached(location.postcode, addressLine),
    ]);

    if (floodRes.status === 'fulfilled') {
      flood = floodRes.value;
      sources.push({ source: 'environment.data.gov.uk/flood', ok: true, lastFetched: Date.now() });
    } else {
      sources.push({
        source: 'environment.data.gov.uk/flood',
        ok: false,
        error: floodRes.reason instanceof Error ? floodRes.reason.message : String(floodRes.reason),
        lastFetched: Date.now(),
      });
    }

    if (heritageRes.status === 'fulfilled') {
      heritage = heritageRes.value;
      sources.push({ source: 'planning.data.gov.uk/heritage', ok: true, lastFetched: Date.now() });
    } else {
      sources.push({
        source: 'planning.data.gov.uk/heritage',
        ok: false,
        error:
          heritageRes.reason instanceof Error ? heritageRes.reason.message : String(heritageRes.reason),
        lastFetched: Date.now(),
      });
    }

    if (article4Res.status === 'fulfilled') {
      article4 = article4Res.value;
      sources.push({ source: 'planning.data.gov.uk/article-4', ok: true, lastFetched: Date.now() });
    } else {
      sources.push({
        source: 'planning.data.gov.uk/article-4',
        ok: false,
        error: article4Res.reason instanceof Error ? article4Res.reason.message : String(article4Res.reason),
        lastFetched: Date.now(),
      });
    }

    if (floodZoneRes.status === 'fulfilled') {
      floodZone = floodZoneRes.value;
      sources.push({ source: 'planning.data.gov.uk/flood-zone', ok: true, lastFetched: Date.now() });
    } else {
      sources.push({
        source: 'planning.data.gov.uk/flood-zone',
        ok: false,
        error:
          floodZoneRes.reason instanceof Error
            ? floodZoneRes.reason.message
            : String(floodZoneRes.reason),
        lastFetched: Date.now(),
      });
    }

    if (envRes.status === 'fulfilled') {
      environmental = envRes.value;
      sources.push({ source: 'planning.data.gov.uk/environmental', ok: true, lastFetched: Date.now() });
    } else {
      sources.push({
        source: 'planning.data.gov.uk/environmental',
        ok: false,
        error: envRes.reason instanceof Error ? envRes.reason.message : String(envRes.reason),
        lastFetched: Date.now(),
      });
    }

    if (tpoRes.status === 'fulfilled') {
      treePreservation = tpoRes.value;
      sources.push({ source: 'planning.data.gov.uk/tree-preservation', ok: true, lastFetched: Date.now() });
    } else {
      sources.push({
        source: 'planning.data.gov.uk/tree-preservation',
        ok: false,
        error: tpoRes.reason instanceof Error ? tpoRes.reason.message : String(tpoRes.reason),
        lastFetched: Date.now(),
      });
    }

    if (brownfieldRes.status === 'fulfilled') {
      brownfield = brownfieldRes.value;
      sources.push({ source: 'planning.data.gov.uk/brownfield', ok: true, lastFetched: Date.now() });
    } else {
      sources.push({
        source: 'planning.data.gov.uk/brownfield',
        ok: false,
        error: brownfieldRes.reason instanceof Error ? brownfieldRes.reason.message : String(brownfieldRes.reason),
        lastFetched: Date.now(),
      });
    }

    if (lpaRes.status === 'fulfilled') {
      localPlanningAuthority = lpaRes.value;
      sources.push({ source: 'planning.data.gov.uk/local-planning-authority', ok: true, lastFetched: Date.now() });
    } else {
      sources.push({
        source: 'planning.data.gov.uk/local-planning-authority',
        ok: false,
        error: lpaRes.reason instanceof Error ? lpaRes.reason.message : String(lpaRes.reason),
        lastFetched: Date.now(),
      });
    }

    if (planningRes.status === 'fulfilled') {
      planningApplications = planningRes.value;
      sources.push({ source: 'planit.org.uk', ok: true, lastFetched: Date.now() });
    } else {
      sources.push({
        source: 'planit.org.uk',
        ok: false,
        error:
          planningRes.reason instanceof Error ? planningRes.reason.message : String(planningRes.reason),
        lastFetched: Date.now(),
      });
    }

    if (priceRes.status === 'fulfilled') {
      pricePaid = priceRes.value;
      sources.push({ source: 'landregistry.data.gov.uk/ppd', ok: true, lastFetched: Date.now() });
    } else {
      sources.push({
        source: 'landregistry.data.gov.uk/ppd',
        ok: false,
        error: priceRes.reason instanceof Error ? priceRes.reason.message : String(priceRes.reason),
        lastFetched: Date.now(),
      });
    }

    if (epcRes.status === 'fulfilled') {
      epc = epcRes.value;
      sources.push({ source: 'get-energy-performance-data.communities.gov.uk', ok: true, lastFetched: Date.now() });
    } else {
      sources.push({
        source: 'get-energy-performance-data.communities.gov.uk',
        ok: false,
        error: epcRes.reason instanceof Error ? epcRes.reason.message : String(epcRes.reason),
        lastFetched: Date.now(),
      });
    }
  }

  return {
    postcode: location?.postcode ?? postcode,
    fetchedAt,
    location,
    coordinateSource,
    titleBoundary,
    flood,
    heritage,
    article4,
    treePreservation,
    floodZone,
    environmental,
    brownfield,
    planningApplications,
    pricePaid,
    epc,
    valuePerSqm: deriveValuePerSqm(pricePaid, epc),
    localPlanningAuthority,
    sources,
  };
}

/**
 * Estimate £/m² from the most recent postcode sale ÷ this property's EPC floor
 * area. Returns null unless both inputs exist and are positive. This is a rough
 * indicator (the sale and the EPC dwelling may differ unless the address
 * matched), so callers should label it as an estimate, not a valuation.
 */
function deriveValuePerSqm(
  pricePaid: PricePaidData | null,
  epc: EpcCertificate | null,
): number | null {
  const amount = pricePaid?.latestSale?.amount;
  const area = epc?.floorAreaSqm;
  if (!amount || !area || amount <= 0 || area <= 0) return null;
  return Math.round(amount / area);
}
