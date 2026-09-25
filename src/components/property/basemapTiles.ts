// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Chooses the basemap tile source for PropertyMap. CARTO has required an API
 * key on every tile request since 23 September 2026; without one it serves a
 * stamped "API KEY REQUIRED" tile. The key is browser-visible by design (it is
 * sent on every tile URL), so it is a build-time variable, not a secret. When
 * it is absent we fall back to the standard OpenStreetMap tiles rather than
 * render a watermarked map.
 */

export interface BasemapTiles {
  url: string;
  attribution: string;
}

export type BasemapVariant = 'boundary' | 'street';

const OSM_TILES: BasemapTiles = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; OpenStreetMap contributors',
};

const CARTO_ATTRIBUTION = '&copy; OpenStreetMap contributors &copy; CARTO';

// Street view uses CARTO Voyager — detailed roads, labels and place names
// (closest free "ordnance-style" basemap); boundary view uses the clean
// Positron basemap. Dark theme uses CARTO dark for both.
function cartoStyle(isDark: boolean, variant: BasemapVariant): string {
  if (isDark) return 'dark_all';
  return variant === 'street' ? 'voyager' : 'light_all';
}

export function basemapTiles(
  isDark: boolean,
  variant: BasemapVariant,
  cartoKey: string | undefined,
): BasemapTiles {
  const key = cartoKey?.trim();
  if (!key) return OSM_TILES;
  return {
    url: `https://basemaps.cartocdn.com/rastertiles/${cartoStyle(isDark, variant)}/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(key)}`,
    attribution: CARTO_ATTRIBUTION,
  };
}
