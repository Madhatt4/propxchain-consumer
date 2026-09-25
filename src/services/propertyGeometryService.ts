// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Fetches the GeoJSON boundary geometry for the planning designations that
 * intersect a property's coordinates, so they can be drawn on the map.
 * planning.data.gov.uk's `/entity.geojson` endpoint returns a FeatureCollection
 * with one feature per matching entity (conservation area, flood zone, listed
 * building, etc.), each carrying its `dataset` in `properties`.
 *
 * Cached in localStorage (24h) keyed on rounded coordinates — designation
 * boundaries are effectively static.
 */

import type { FeatureCollection } from 'geojson';

const DATASETS = [
  'conservation-area',
  'flood-risk-zone',
  'listed-building',
  'park-and-garden',
  'scheduled-monument',
  'world-heritage-site',
  'green-belt',
  'site-of-special-scientific-interest',
  'area-of-outstanding-natural-beauty',
  'national-park',
  'ancient-woodland',
];

const CACHE_PREFIX = 'propxchain:geo:';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Brand-aligned colour per designation dataset. */
const DATASET_COLOR: Record<string, string> = {
  'conservation-area': '#D97706',
  'flood-risk-zone': '#2563EB',
  'listed-building': '#DC2626',
  'park-and-garden': '#9333EA',
  'scheduled-monument': '#7C3AED',
  'world-heritage-site': '#C026D3',
  'green-belt': '#059669',
  'site-of-special-scientific-interest': '#16A34A',
  'area-of-outstanding-natural-beauty': '#65A30D',
  'national-park': '#15803D',
  'ancient-woodland': '#4D7C0F',
};

const DATASET_LABEL: Record<string, string> = {
  'conservation-area': 'Conservation area',
  'flood-risk-zone': 'Flood zone',
  'listed-building': 'Listed building',
  'park-and-garden': 'Park & garden',
  'scheduled-monument': 'Scheduled monument',
  'world-heritage-site': 'World Heritage Site',
  'green-belt': 'Green belt',
  'site-of-special-scientific-interest': 'SSSI',
  'area-of-outstanding-natural-beauty': 'AONB',
  'national-park': 'National park',
  'ancient-woodland': 'Ancient woodland',
};

export function datasetColor(dataset: string): string {
  return DATASET_COLOR[dataset] ?? '#0D9488';
}

export function datasetLabel(dataset: string): string {
  return DATASET_LABEL[dataset] ?? dataset.replace(/-/g, ' ');
}

function readCache(key: string): FeatureCollection | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const env = JSON.parse(raw) as { value: FeatureCollection; storedAt: number };
    if (Date.now() - env.storedAt > CACHE_TTL_MS) {
      window.localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return env.value;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: FeatureCollection): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ value, storedAt: Date.now() }));
  } catch {
    // best-effort cache only
  }
}

/** Fetch intersecting designation boundaries as a GeoJSON FeatureCollection. */
export async function getPropertyGeometry(lat: number, lng: number): Promise<FeatureCollection> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = readCache(key);
  if (cached) return cached;

  const datasets = DATASETS.map((d) => `dataset=${encodeURIComponent(d)}`).join('&');
  const url =
    `https://www.planning.data.gov.uk/entity.geojson` +
    `?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}&${datasets}&limit=50`;

  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`planning.data.gov.uk geojson returned ${res.status}`);
  }
  const fc = (await res.json()) as FeatureCollection;
  writeCache(key, fc);
  return fc;
}
