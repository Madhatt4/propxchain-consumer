// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import type { FeatureCollection } from 'geojson';

/** Whether the property's designation geometry includes any of these datasets. */
export function hasDataset(geometry: FeatureCollection | null, datasets: readonly string[]): boolean {
  return (geometry?.features ?? []).some((f) => {
    const d = (f.properties as Record<string, unknown> | null)?.['dataset'];
    return typeof d === 'string' && datasets.includes(d);
  });
}

export const FLOOD_DATASETS = ['flood-risk-zone'] as const;
export const DESIGNATION_DATASETS = [
  'conservation-area',
  'listed-building',
  'park-and-garden',
  'scheduled-monument',
  'world-heritage-site',
  'green-belt',
  'site-of-special-scientific-interest',
  'area-of-outstanding-natural-beauty',
  'national-park',
  'ancient-woodland',
] as const;
