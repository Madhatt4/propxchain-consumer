// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import type { FieldProvenance, PropertyListing, Tenure } from '@/types/listing.types';
import type { EpcCertificate } from '@/services/epc.service';
import type { MaterialInfo, MaterialInfoField, MaterialInfoOverrides, MaterialInfoSource } from '@/types/materialInfo.types';

const MISSING = { value: null, source: 'missing' as const };

function field<T>(value: T | null | undefined, source: MaterialInfoSource): MaterialInfoField<T> {
  return value === null || value === undefined ? MISSING : { value, source };
}
function pick<T>(...candidates: Array<[T | null | undefined, MaterialInfoSource]>): MaterialInfoField<T> {
  for (const [v, s] of candidates) if (v !== null && v !== undefined) return { value: v, source: s };
  return MISSING;
}
const nonZero = (n: number | undefined): number | null => (n && n > 0 ? n : null);
const known = (s: string | null | undefined): string | null => (s && s !== 'unknown' ? s : null);

export function emptyMaterialInfo(): MaterialInfo {
  return {
    price: MISSING, tenure: MISSING, councilTaxBand: MISSING, epcRating: MISSING, epcFloorAreaSqm: MISSING,
    leaseYearsRemaining: MISSING, groundRentPerYear: MISSING, serviceChargePerYear: MISSING,
    floodRisk: MISSING, conservationArea: MISSING, listedBuilding: MISSING,
  };
}

/** Fills in any field missing from a partially-shaped `MaterialInfo` (the
 *  DB column defaults to `{}` for a brand-new row) with the "missing" state,
 *  so a renderer never has to guard against `undefined.value`. */
export function normalizeMaterialInfo(info: Partial<MaterialInfo>): MaterialInfo {
  const empty = emptyMaterialInfo();
  return {
    price: info.price ?? empty.price,
    tenure: info.tenure ?? empty.tenure,
    councilTaxBand: info.councilTaxBand ?? empty.councilTaxBand,
    epcRating: info.epcRating ?? empty.epcRating,
    epcFloorAreaSqm: info.epcFloorAreaSqm ?? empty.epcFloorAreaSqm,
    leaseYearsRemaining: info.leaseYearsRemaining ?? empty.leaseYearsRemaining,
    groundRentPerYear: info.groundRentPerYear ?? empty.groundRentPerYear,
    serviceChargePerYear: info.serviceChargePerYear ?? empty.serviceChargePerYear,
    floodRisk: info.floodRisk ?? empty.floodRisk,
    conservationArea: info.conservationArea ?? empty.conservationArea,
    listedBuilding: info.listedBuilding ?? empty.listedBuilding,
  };
}

/** Merge listing facts, EPC certificate and agent overrides. Precedence: agent > epc > listing. */
export function buildMaterialInfo(
  listing: PropertyListing,
  epc: EpcCertificate | null,
  overrides: MaterialInfoOverrides,
): MaterialInfo {
  return {
    price: field(nonZero(listing.price), 'listing'),
    tenure: field(known(listing.tenure), 'listing'),
    councilTaxBand: pick([overrides.councilTaxBand, 'agent'], [listing.councilTaxBand, 'listing']),
    epcRating: pick([epc?.currentBand, 'epc'], [listing.epcRating, 'listing']),
    epcFloorAreaSqm: field(epc?.floorAreaSqm ?? null, 'epc'),
    leaseYearsRemaining: pick([overrides.leaseYearsRemaining, 'agent'], [nonZero(listing.leaseYearsRemaining), 'listing']),
    groundRentPerYear: pick([overrides.groundRentPerYear, 'agent'], [nonZero(listing.groundRentPerYear), 'listing']),
    serviceChargePerYear: pick([overrides.serviceChargePerYear, 'agent'], [nonZero(listing.serviceChargePerYear), 'listing']),
    floodRisk: field(overrides.floodRisk, 'agent'),
    conservationArea: field(overrides.conservationArea, 'agent'),
    listedBuilding: field(overrides.listedBuilding, 'agent'),
  };
}

const PROVENANCE_BY_SOURCE: Partial<Record<MaterialInfoSource, FieldProvenance>> = {
  agent: 'agent',
  epc: 'epc-register',
  listing: 'adapter',
};

function asTenure(raw: string | null): Tenure | null {
  const t = (raw ?? '').trim().toLowerCase();
  if (t === 'freehold' || t === 'leasehold' || t === 'shareoffreehold') return t === 'shareoffreehold' ? 'shareOfFreehold' : t;
  return null;
}

/**
 * The listing a transaction should start from: the agent's listing with
 * every material-information value the agent (or the EPC register) supplied
 * filled into its blanks, provenance tagged by source. This is what makes
 * an agent-typed council tax band or lease figure reach the seller's Stage 1,
 * the sales pack and the TA forms without being typed again.
 */
export function listingWithMaterialInfo(listing: PropertyListing, info: MaterialInfo | null | undefined): PropertyListing {
  if (!info) return listing;
  const next: PropertyListing = { ...listing, provenance: { ...listing.provenance } };
  let changed = false;
  const tag = (key: keyof PropertyListing & keyof typeof next.provenance, source: MaterialInfoSource): void => {
    const p = PROVENANCE_BY_SOURCE[source];
    if (p) next.provenance[key] = p;
  };

  const tenure = asTenure(info.tenure?.value ?? null);
  if (listing.tenure === 'unknown' && tenure) { next.tenure = tenure; tag('tenure', info.tenure.source); changed = true; }
  if (!(listing.councilTaxBand ?? '').trim() && info.councilTaxBand?.value) {
    next.councilTaxBand = info.councilTaxBand.value; tag('councilTaxBand', info.councilTaxBand.source); changed = true;
  }
  if (!(listing.epcRating ?? '').trim() && info.epcRating?.value) {
    next.epcRating = info.epcRating.value; tag('epcRating', info.epcRating.source); changed = true;
  }
  if (!((listing.leaseYearsRemaining ?? 0) > 0) && (info.leaseYearsRemaining?.value ?? 0) > 0) {
    next.leaseYearsRemaining = info.leaseYearsRemaining.value as number; tag('leaseYearsRemaining', info.leaseYearsRemaining.source); changed = true;
  }
  if (listing.groundRentPerYear == null && info.groundRentPerYear?.value != null) {
    next.groundRentPerYear = info.groundRentPerYear.value; tag('groundRentPerYear', info.groundRentPerYear.source); changed = true;
  }
  if (listing.serviceChargePerYear == null && info.serviceChargePerYear?.value != null) {
    next.serviceChargePerYear = info.serviceChargePerYear.value; tag('serviceChargePerYear', info.serviceChargePerYear.source); changed = true;
  }
  return changed ? next : listing;
}
