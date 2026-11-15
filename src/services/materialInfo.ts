// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The ONE rule for "material information complete". The Sales pack row and
 * the Stage 1 form both call this, so Stage 1 can never be completed with a
 * gap the pack still reports (the dead-end loop Marc hit on 2026-11-15:
 * Stage 1 ticked, pack row unticked, its button pointing back at Stage 1).
 *
 * Pure on purpose: the Stage 1 form imports it, and that form must not pull
 * the readiness loader's service graph into its bundle or its tests.
 */
import type { PropertyListing } from '@/types/listing.types';

export type MaterialInfoGap =
  | 'address'
  | 'postcode'
  | 'price'
  | 'tenure'
  | 'propertyType'
  | 'councilTaxBand'
  | 'leaseYearsRemaining'
  | 'groundRentPerYear'
  | 'serviceChargePerYear';

/** The listing fields the rule reads; the Stage 1 form projects onto this. */
export type MaterialInfoListingFields = Pick<
  PropertyListing,
  | 'address'
  | 'postcode'
  | 'price'
  | 'tenure'
  | 'propertyType'
  | 'councilTaxBand'
  | 'leaseYearsRemaining'
  | 'groundRentPerYear'
  | 'serviceChargePerYear'
>;

/** Plain words for the "Missing: ..." status line. */
export const MATERIAL_INFO_FIELD_LABEL: Record<MaterialInfoGap, string> = {
  address: 'address',
  postcode: 'postcode',
  price: 'asking price',
  tenure: 'tenure',
  propertyType: 'property type',
  councilTaxBand: 'council tax band',
  leaseYearsRemaining: 'years left on the lease',
  groundRentPerYear: 'ground rent',
  serviceChargePerYear: 'service charge',
};

const ALL_CORE: MaterialInfoGap[] = [
  'address', 'postcode', 'price', 'tenure', 'propertyType', 'councilTaxBand',
];

function isBlank(s: string | null | undefined): boolean {
  return (s ?? '').trim().length === 0;
}

/** A cost may be zero (a peppercorn ground rent) but never absent or negative. */
function isMissingCost(n: number | null | undefined): boolean {
  return n == null || !Number.isFinite(n) || n < 0;
}

/**
 * Which disclosure fields are still missing, in display order. Empty means
 * complete. The lease trio is asked only once tenure is leasehold. EPC is
 * deliberately excluded: it is its own pack item.
 */
export function materialInfoMissing(listing: MaterialInfoListingFields | null): MaterialInfoGap[] {
  if (!listing) return [...ALL_CORE];
  const missing: MaterialInfoGap[] = [];
  if (isBlank(listing.address)) missing.push('address');
  if (isBlank(listing.postcode)) missing.push('postcode');
  if (!(listing.price > 0)) missing.push('price');
  if (listing.tenure == null || listing.tenure === 'unknown') missing.push('tenure');
  if (isBlank(listing.propertyType)) missing.push('propertyType');
  if (isBlank(listing.councilTaxBand)) missing.push('councilTaxBand');
  if (listing.tenure === 'leasehold') {
    if (!((listing.leaseYearsRemaining ?? 0) > 0)) missing.push('leaseYearsRemaining');
    if (isMissingCost(listing.groundRentPerYear)) missing.push('groundRentPerYear');
    if (isMissingCost(listing.serviceChargePerYear)) missing.push('serviceChargePerYear');
  }
  return missing;
}
