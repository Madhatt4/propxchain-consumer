// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * Fill a stored listing's blanks from free public records and persist the
 * result — the write-back the Property tab and the Stage 1 autofill never
 * did. A URL import almost never carries an EPC band (portals show it as an
 * image or "Ask agent"), and the free EPC-register lookup previously lived
 * only inside the List Property form, landing on the listing only when the
 * seller pressed Save there. Sellers who created the transaction from a URL
 * therefore saw "EPC rating on the listing" stuck at not-done even though the
 * Property tab was displaying the certificate.
 *
 * Only blanks are filled — never a value the seller typed or the portal gave.
 */
import type { PropertyListing } from '@/types/listing.types';
import type { EpcCertificate } from './epc.service';
import { getEpcCached } from './propertyIntelligenceService';
import { getRightmoveData, storeRightmoveData } from '@/utils/rightmoveStorage';

const EPC_BANDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

function hasEpcBand(listing: PropertyListing): boolean {
  return EPC_BANDS.includes((listing.epcRating ?? '').trim().toUpperCase());
}

/** Anything free public records can add to this listing? */
export function needsPublicRecordEnrichment(listing: PropertyListing | null): boolean {
  if (!listing || !listing.postcode.trim()) return false;
  return !hasEpcBand(listing) || !(listing.uprn ?? '').trim();
}

/**
 * Pure step: the listing with EPC band and UPRN filled from a certificate
 * where blank, or the same object when nothing was missing.
 */
export function applyEpcCertificate(
  listing: PropertyListing,
  epc: EpcCertificate | null,
): PropertyListing {
  if (!epc) return listing;
  const next: PropertyListing = { ...listing, provenance: { ...listing.provenance } };
  let changed = false;
  if (!hasEpcBand(listing) && epc.currentBand) {
    next.epcRating = epc.currentBand;
    next.provenance.epcRating = 'epc-register';
    changed = true;
  }
  if (!(listing.uprn ?? '').trim() && epc.uprn) {
    next.uprn = epc.uprn;
    next.provenance.uprn = 'epc-register';
    changed = true;
  }
  return changed ? next : listing;
}

/**
 * Return the listing with EPC band and UPRN filled from the register where
 * blank, or the same object when nothing was found or nothing was missing.
 */
export async function enrichListingFromPublicRecords(
  listing: PropertyListing,
): Promise<PropertyListing> {
  if (!needsPublicRecordEnrichment(listing)) return listing;
  const epc = await getEpcCached(listing.postcode, listing.addressLine1 ?? listing.address);
  return applyEpcCertificate(listing, epc);
}

/**
 * The Property tab already holds the certificate from its free-API report:
 * push it into the stored listing so the sales pack ticks without a second
 * lookup. Returns true when the listing changed (caller refreshes the meter).
 */
export function applyReportEpcToListing(
  transactionId: string,
  epc: EpcCertificate | null,
): boolean {
  const listing = getRightmoveData(transactionId);
  if (!listing) return false;
  const enriched = applyEpcCertificate(listing, epc);
  if (enriched === listing) return false;
  void storeRightmoveData(transactionId, enriched);
  return true;
}

/**
 * Enrich and, when anything changed, persist to localStorage + chain. The
 * chain write's outcome is deliberately not surfaced: the local cache is
 * what the meter reads, and a seller's next Stage 1 save re-syncs the chain.
 */
export async function enrichAndStoreListing(
  transactionId: string,
  listing: PropertyListing,
): Promise<PropertyListing> {
  const enriched = await enrichListingFromPublicRecords(listing);
  if (enriched !== listing) void storeRightmoveData(transactionId, enriched);
  return enriched;
}
