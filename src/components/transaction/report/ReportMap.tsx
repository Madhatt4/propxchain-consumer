// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * A map inside a report section: the existing PropertyMap, drawing only the
 * datasets that section is about. Lazy, because Leaflet needs `window` and
 * must stay out of the prerendered HTML and the main bundle.
 */

import { lazy, Suspense, type ReactElement } from 'react';
import type { FeatureCollection } from 'geojson';

import { R } from './reportStyles';

const PropertyMap = lazy(() => import('../../property/PropertyMap'));

interface ReportMapProps {
  lat: number;
  lng: number;
  label: string;
  geometry: FeatureCollection | null;
  datasets: string[];
  variant: 'boundary' | 'street';
  caption: string;
  heightClass?: string;
}

export function ReportMap({ lat, lng, label, geometry, datasets, variant, caption, heightClass = 'h-72' }: ReportMapProps): ReactElement {
  return (
    <figure className="m-0">
      <div className={`${heightClass} overflow-hidden rounded-lg border ${R.rule}`}>
        <Suspense fallback={<div className="h-full w-full animate-pulse bg-[#EEF2EE] dark:bg-[#1F2937]" />}>
          <PropertyMap key={variant} lat={lat} lng={lng} label={label} geometry={geometry} activeDatasets={datasets} variant={variant} />
        </Suspense>
      </div>
      <figcaption className={`mt-2 ${R.source}`}>{caption}</figcaption>
    </figure>
  );
}

