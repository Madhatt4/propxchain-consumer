// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * Two-way bridge between the listing and the TA forms, so a fact gathered
 * anywhere is typed once (audit gaps G4 + G5).
 *
 *  - Listing → TA6 §1: address, postcode, UPRN when the form is blank.
 *  - Listing → TA7: ground rent and service charge (the listing holds them
 *    per year; TA7 stores an amount plus a frequency) when blank.
 *  - TA7 → listing: on save, lease years remaining (from the expiry date),
 *    ground rent and service charge fill blanks on the listing, tagged
 *    'user' because the seller typed them into the form.
 *
 * Blanks only, in both directions. Nothing a seller entered is overwritten.
 */
import type { PropertyListing } from '@/types/listing.types';
import type { TA6PropertyInformation } from '@/types/ta6.types';
import { calculateRemainingLeaseYears, type TA7LeaseholdInformation } from '@/types/ta7.types';

export interface PrefillResult<T> {
  form: T;
  /** Human labels of the fields that were filled, for the review banner. */
  filled: string[];
}

function isBlank(v: string | null | undefined): boolean {
  return (v ?? '').trim().length === 0;
}

/** TA6 §1 identity fields from the listing, when the form has none. */
export function prefillTa6FromListing(
  form: TA6PropertyInformation,
  listing: PropertyListing | null,
): PrefillResult<TA6PropertyInformation> {
  if (!listing) return { form, filled: [] };
  const filled: string[] = [];
  const s1 = { ...form.section1 };
  if (isBlank(s1.propertyAddress) && !isBlank(listing.address)) {
    s1.propertyAddress = listing.address.trim();
    filled.push('Property address');
  }
  if (isBlank(s1.postcode) && !isBlank(listing.postcode)) {
    s1.postcode = listing.postcode.trim();
    filled.push('Postcode');
  }
  if (isBlank(s1.uprn) && !isBlank(listing.uprn)) {
    s1.uprn = (listing.uprn ?? '').trim();
    filled.push('UPRN');
  }
  if (filled.length === 0) return { form, filled };
  return { form: { ...form, section1: s1 }, filled };
}

/** TA7 money fields from the listing's material information, when blank. */
export function prefillTa7FromListing(
  form: TA7LeaseholdInformation,
  listing: PropertyListing | null,
): PrefillResult<TA7LeaseholdInformation> {
  if (!listing) return { form, filled: [] };
  const filled: string[] = [];
  const next = { ...form };
  if (!(form.groundRentAmount > 0) && (listing.groundRentPerYear ?? 0) > 0) {
    next.groundRentAmount = listing.groundRentPerYear as number;
    next.groundRentPaymentFrequency = 'annual';
    filled.push('Ground rent');
  }
  if (!(form.serviceChargeAmount > 0) && (listing.serviceChargePerYear ?? 0) > 0) {
    next.serviceChargeAmount = listing.serviceChargePerYear as number;
    next.serviceChargePaymentFrequency = 'annual';
    filled.push('Service charge');
  }
  if (filled.length === 0) return { form, filled };
  return { form: next, filled };
}

const PER_YEAR: Partial<Record<TA7LeaseholdInformation['groundRentPaymentFrequency'], number>> = {
  annual: 1,
  quarterly: 4,
  monthly: 12,
  '': 1,
};

/**
 * Listing lease trio from a saved TA7. Returns the same object when the
 * listing already has every value the form could supply.
 */
export function listingFromTa7(
  listing: PropertyListing,
  ta7: TA7LeaseholdInformation,
): PropertyListing {
  const next: PropertyListing = { ...listing, provenance: { ...listing.provenance } };
  let changed = false;
  const years = ta7.leaseExpiryDate ? calculateRemainingLeaseYears(ta7.leaseExpiryDate) : 0;
  if (!((listing.leaseYearsRemaining ?? 0) > 0) && years > 0) {
    next.leaseYearsRemaining = years;
    next.provenance.leaseYearsRemaining = 'user';
    changed = true;
  }
  if (listing.groundRentPerYear == null && ta7.groundRentAmount > 0) {
    next.groundRentPerYear = ta7.groundRentAmount * (PER_YEAR[ta7.groundRentPaymentFrequency] ?? 1);
    next.provenance.groundRentPerYear = 'user';
    changed = true;
  }
  if (listing.serviceChargePerYear == null && ta7.serviceChargeAmount > 0) {
    next.serviceChargePerYear = ta7.serviceChargeAmount * (PER_YEAR[ta7.serviceChargePaymentFrequency] ?? 1);
    next.provenance.serviceChargePerYear = 'user';
    changed = true;
  }
  return changed ? next : listing;
}

/** Listing UPRN from a saved TA6 §1, when the listing had none. */
export function listingFromTa6(
  listing: PropertyListing,
  ta6: TA6PropertyInformation,
): PropertyListing {
  const uprn = (ta6.section1.uprn ?? '').trim();
  if (!uprn || !isBlank(listing.uprn)) return listing;
  return { ...listing, uprn, provenance: { ...listing.provenance, uprn: 'user' } };
}
