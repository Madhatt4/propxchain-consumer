// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Leaflet map for the property intelligence card: a pin at the property's
 * (postcode-centroid) location plus the planning-designation boundaries the
 * parent has toggled on, drawn as brand-coloured polygons. Pure renderer — the
 * card owns the geometry fetch and the active-layer state. Client-only;
 * imported lazily so Leaflet never runs during prerender. CARTO tiles when a
 * key is configured, OpenStreetMap otherwise (see basemapTiles).
 */

import React, { useEffect } from 'react';
import { CircleMarker, GeoJSON, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { PathOptions } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '../../contexts/ThemeContext';
import { datasetColor, datasetLabel } from '@/services/propertyGeometryService';
import { basemapTiles } from './basemapTiles';

/**
 * Recomputes the map size after mount and whenever `dep` changes. The container
 * is lazy-revealed and changes height between views, so Leaflet's cached size
 * goes stale and tiles fail to load (a grey map) without this.
 */
const MapResizer: React.FC<{ dep: unknown }> = ({ dep }) => {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const id = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(id);
  }, [map, dep]);
  return null;
};

interface PropertyMapProps {
  lat: number;
  lng: number;
  label: string;
  geometry: FeatureCollection | null;
  /** Dataset keys whose boundaries should currently be drawn. */
  activeDatasets: string[];
  /**
   * 'boundary' (default): clean minimal basemap zoomed to show designation
   * boundaries. 'street': detailed road-level basemap zoomed in on the plot.
   */
  variant?: 'boundary' | 'street';
}

const TEAL = '#0D9488';

function featureDataset(feature?: Feature<Geometry, unknown>): string {
  const props = (feature?.properties ?? {}) as Record<string, unknown>;
  return typeof props['dataset'] === 'string' ? props['dataset'] : '';
}

const PropertyMap: React.FC<PropertyMapProps> = ({
  lat,
  lng,
  label,
  geometry,
  activeDatasets,
  variant = 'boundary',
}) => {
  const { theme } = useTheme();
  const street = variant === 'street';
  const zoom = street ? 17 : 15;

  const tiles = basemapTiles(theme === 'dark', variant, import.meta.env.VITE_CARTO_BASEMAPS_KEY);

  const active = new Set(activeDatasets);
  const shown: FeatureCollection | null = geometry
    ? { type: 'FeatureCollection', features: geometry.features.filter((f) => active.has(featureDataset(f))) }
    : null;

  const style = (feature?: Feature<Geometry, unknown>): PathOptions => {
    const color = datasetColor(featureDataset(feature));
    return { color, weight: 2, fillColor: color, fillOpacity: 0.15 };
  };

  const present = shown
    ? Array.from(new Set(shown.features.map((f) => featureDataset(f)).filter((d) => d.length > 0)))
    : [];

  return (
    <div className="relative h-full min-h-[16rem] w-full overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700">
      <MapContainer center={[lat, lng]} zoom={zoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <MapResizer dep={`${variant}|${zoom}|${lat},${lng}`} />
        <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />
        {shown && shown.features.length > 0 && (
          <GeoJSON key={activeDatasets.slice().sort().join(',')} data={shown} style={style} />
        )}
        <CircleMarker
          center={[lat, lng]}
          radius={8}
          pathOptions={{ color: TEAL, fillColor: TEAL, fillOpacity: 0.9, weight: 2 }}
        >
          <Tooltip>{`${label} · approx. postcode area`}</Tooltip>
        </CircleMarker>
      </MapContainer>
      {present.length > 0 && (
        <div className="pointer-events-none absolute bottom-2 left-2 z-[1000] rounded-md bg-white/90 p-2 text-[11px] shadow dark:bg-gray-900/90">
          {present.map((ds) => (
            <div key={ds} className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: datasetColor(ds) }} />
              {datasetLabel(ds)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PropertyMap;
