// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Property-specific search boundary from HM Land Registry INSPIRE Index Polygons.
 *
 * Groundsure's environmental / flood / planning / geo-risk reports are area-based:
 * whatever polygon we send is the land they assess. A box around the POSTCODE
 * centroid can sit over next door, so the buyer gets a clean report on land that
 * is not their house. This resolves the property's OWN registered freehold parcel
 * instead, by spatial containment:
 *
 *     UPRN -> BNG point (OS Open UPRN) -> the parcel that contains it -> WKT
 *
 * WHY CONTAINMENT AND NOT THE HMLR LOOKUP TABLES. From 2026-08-28 HMLR publishes
 * UPRN and INSPIRE-ID lookups against Price Paid Data. Those attach only to PPD
 * published from that date onward and are never backfilled, so a seller whose
 * house last sold in 2019 has no row. Building on them would quietly fall back to
 * the box for most sellers - the exact failure this replaces. Containment works
 * for any property in an ingested council.
 *
 * KNOWN LIMITATIONS, by design and not worth hiding:
 *  - FREEHOLD ONLY. INSPIRE covers registered freehold parcels. A leasehold flat
 *    has no parcel of its own; its UPRN lands inside the building's freehold
 *    parcel. That is the right footprint for an area-based hazard search but it is
 *    NOT that flat's demise, and must never be shown as a legal boundary.
 *  - UNREGISTERED LAND has no parcel at all (~14% of England and Wales by area).
 *  - SNAPSHOT, not live. Rows carry ingested_at; INSPIRE is refreshed monthly.
 *  - COUNCIL BY COUNCIL, BUT NOT FOR THE REASON IT USED TO BE. The parcels are
 *    now national: the inspire-title Worker serves the whole of England and
 *    Wales from one FlatGeobuf on R2. What is still ingested council by council
 *    is the OS Open UPRN pin, and no pin means no point to look the parcel up
 *    with -- so coverage is now gated by `geo.os_open_uprn`, not by polygons.
 *    Measured on the Central Bedfordshire ingest: where we hold the pin, 69% of
 *    UPRNs resolve to their own parcel; the remainder is unregistered land and
 *    leasehold blocks.
 *
 * Every one of those degrades quietly down the chain in resolvePropertyBoundary.
 * Nothing here throws.
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';

import { getTitleBoundary } from './titlePolygon.service';

import {
  DEFAULT_HALF_SIZE_METRES,
  pointToBufferWkt,
  resolveBoundaryFromPostcode,
  type BngPoint,
  type ResolvedBoundary,
} from './propertyBoundary.service';

/**
 * Largest parcel we will send, in square metres (1 ha).
 *
 * Four of Groundsure's residential products - Homescreen, Homebuyers, Planning
 * and Flood, including the two cheapest bundles the panel leads with - cap the
 * search area at 1 ha and answer `price: null, invalid_reason: "needs_estimate"`
 * above it (confirmed live 2026-08-29, and by Marek Lukowski at Groundsure on
 * 2026-09-01).
 *
 * THIS IS THE THRESHOLD THAT DOES THE WORK. Measured against the full Central
 * Bedfordshire ingest (143,060 parcels, 2026-09-01): 3.9% of parcels exceed 1 ha,
 * but they are large, so they catch a wildly disproportionate share of UPRNs -
 * of 2,454 sampled UPRNs that landed in a parcel at all, 736 (30%) landed in one
 * over 1 ha. In built-up areas it is ~2%; the rest is rural, where a farm or
 * smallholding UPRN sits inside a parcel of tens of hectares.
 *
 * Without this branch roughly a third of orders would go straight back to
 * needs_estimate on the four products #286 just fixed.
 */
export const MAX_PARCEL_AREA_SQ_METRES = 10_000;

/**
 * Smallest parcel we will treat as a property outline, in square metres.
 *
 * INSPIRE contains slivers - access strips, verges, and fragments left by
 * historic registrations. 5.5% of Central Bedfordshire's parcels are under 20 m2.
 * A UPRN landing in one would send Groundsure a site outline smaller than a
 * parking space: it prices happily (the API picks the tier from the area) and
 * then assesses almost nothing, under-reporting hazards.
 *
 * Unlike the 1 ha ceiling this is a RARE path - slivers are small, so UPRNs
 * seldom fall in them: 2 of 2,454 sampled parcel hits (0.08%). But it does happen,
 * and the smallest real hit measured was 9.4 m2, which we would otherwise have
 * sent as a site outline. Cheap insurance against a silent wrong answer.
 */
export const MIN_PARCEL_AREA_SQ_METRES = 20;

/** One row of public.resolve_uprn_point. */
interface UprnPointRow {
  easting: number;
  northing: number;
  lat: number;
  lng: number;
}

/** What the UPRN lookup found: always the pin, and the parcel when there is one. */
export interface InspireLookup {
  centre: BngPoint;
  inspireId: number | null;
  boundaryWkt: string | null;
  areaSqMetres: number | null;
}

function isFinitePoint(point: BngPoint): boolean {
  return Number.isFinite(point.easting) && Number.isFinite(point.northing);
}

/**
 * A parcel in more than one piece.
 *
 * The PostGIS store this replaces refused these outright, returning no WKT when
 * `ST_NumGeometries > 1`, on the grounds that a MULTIPOLYGON site outline had
 * never been tested against Groundsure. Central Bedfordshire had 0 of 143,060,
 * so it cost nothing there -- but the parcels are national now, and this is the
 * first time properties outside one ingested council can reach that code path.
 * Switching data source is not the moment to start sending a paid supplier a
 * geometry shape nobody has ever tried; these degrade to the UPRN box, exactly
 * as they did before, until someone tests one deliberately.
 */
function isMultiPart(parcel: { geojson: { type: string; coordinates: unknown[] } }): boolean {
  return parcel.geojson.type === 'MultiPolygon' && parcel.geojson.coordinates.length > 1;
}

/**
 * Look one UPRN up: its own pin from OS Open UPRN, then the registered parcel
 * covering that pin from the inspire-title Worker.
 *
 * Returns null when the UPRN is unknown, malformed, or the lookup fails - the
 * caller cannot tell those apart and does not need to, because all three degrade
 * the same way. A pin WITHOUT a parcel is not null: it is the `uprn-centroid`
 * rung of the chain, and still the right house.
 */
export async function lookupInspireParcel(uprn: string): Promise<InspireLookup | null> {
  const trimmed = uprn?.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase.rpc('resolve_uprn_point', { p_uprn: trimmed });

  if (error) {
    logger.warn('lookupInspireParcel: UPRN point lookup failed', { uprn: trimmed, error });
    return null;
  }

  const row = ((data ?? []) as UprnPointRow[])[0];
  if (!row) return null;

  const centre: BngPoint = { easting: Number(row.easting), northing: Number(row.northing) };
  if (!isFinitePoint(centre)) {
    logger.warn('lookupInspireParcel: UPRN has no usable grid reference', { uprn: trimmed });
    return null;
  }

  // A worker that is down, unconfigured, or simply has no parcel for the point
  // all mean the same thing to the caller: no outline, but we still know the
  // house. getTitleBoundary is documented never to throw and the catch is
  // therefore unreachable today -- but it is not free to omit. Letting a
  // rejection escape would abandon the pin as well as the parcel and drop the
  // whole lookup to the postcode centroid, which can be next door. A worker
  // outage must cost the outline, not the address.
  let parcel = null;
  try {
    parcel = await getTitleBoundary(row.lat, row.lng);
  } catch (err) {
    logger.warn('lookupInspireParcel: title lookup threw, keeping the pin', {
      uprn: trimmed,
      err,
    });
  }

  if (parcel && (isMultiPart(parcel) || !parcel.wkt27700)) {
    logger.info('lookupInspireParcel: parcel unusable as a site outline, keeping the pin', {
      uprn: trimmed,
      inspireId: parcel.inspireId,
      multiPart: isMultiPart(parcel),
    });
    return { centre, inspireId: null, boundaryWkt: null, areaSqMetres: null };
  }

  return {
    centre,
    inspireId: parcel?.inspireId ?? null,
    // BNG, because that is what Groundsure and PISCES take. The Worker returns
    // both projections; 4326 is for the map and the planning.data.gov.uk query.
    boundaryWkt: parcel?.wkt27700 ?? null,
    areaSqMetres: parcel?.areaSqMetres ?? null,
  };
}

/** Input for the full resolution chain. */
export interface ResolvePropertyBoundaryInput {
  /** UPRN from the EPC register, when the listing captured one. */
  uprn?: string | null;
  /** Always required - the last-resort fallback resolves from this. */
  postcode: string;
  /** Half-side of the fallback box, in metres. */
  halfSizeMetres?: number;
}

/**
 * Resolve a property to the best WKT boundary available, degrading quietly:
 *
 *   1. 'inspire-polygon'   the containing freehold parcel, if it is a sane size
 *   2. 'uprn-centroid'     a box on the UPRN pin - right house, square shape
 *   3. 'postcode-centroid' a box on the postcode centroid - today's behaviour
 *
 * Returns null only when even the postcode will not resolve. Never throws.
 */
export async function resolvePropertyBoundary(
  input: ResolvePropertyBoundaryInput,
): Promise<ResolvedBoundary | null> {
  const halfSizeMetres = input.halfSizeMetres ?? DEFAULT_HALF_SIZE_METRES;
  const uprn = input.uprn?.trim();

  if (uprn) {
    let found: InspireLookup | null = null;
    try {
      found = await lookupInspireParcel(uprn);
    } catch (err) {
      // The chain must survive anything the client throws - a network failure
      // here is not a reason to fail an order a postcode could still serve.
      logger.warn('resolvePropertyBoundary: INSPIRE lookup threw, degrading', { uprn, err });
    }

    if (found && isFinitePoint(found.centre)) {
      const { areaSqMetres, boundaryWkt } = found;
      const isUsableParcel =
        Boolean(boundaryWkt) &&
        areaSqMetres !== null &&
        areaSqMetres >= MIN_PARCEL_AREA_SQ_METRES &&
        areaSqMetres <= MAX_PARCEL_AREA_SQ_METRES;

      if (isUsableParcel && boundaryWkt) {
        return {
          wkt: boundaryWkt,
          centre: found.centre,
          halfSizeMetres: null,
          source: 'inspire-polygon',
          ...(found.inspireId !== null ? { inspireId: found.inspireId } : {}),
          ...(areaSqMetres !== null ? { areaSqMetres } : {}),
        };
      }

      // We know the house but not a usable outline for it - no parcel, an
      // oversized estate parcel, or a sliver. A box on the UPRN pin is still
      // centred on the right property, which the postcode centroid may not be.
      logger.info('resolvePropertyBoundary: parcel unusable, boxing the UPRN pin', {
        uprn,
        areaSqMetres,
        hasParcel: Boolean(boundaryWkt),
      });
      return {
        wkt: pointToBufferWkt(found.centre, halfSizeMetres),
        centre: found.centre,
        halfSizeMetres,
        source: 'uprn-centroid',
      };
    }
  }

  return resolveBoundaryFromPostcode(input.postcode, halfSizeMetres);
}
