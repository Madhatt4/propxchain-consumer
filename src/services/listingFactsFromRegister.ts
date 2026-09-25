// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * Fill the listing's tenure and address from the registers we already hold,
 * and flag where the register disagrees with what the seller entered.
 *
 * Two sources, in order of authority:
 *  1. The paid HMLR title register, once pulled for this transaction
 *     (tenure, registered address). Authoritative; only blanks are filled,
 *     and every disagreement is reported rather than silently resolved.
 *  2. Land Registry price-paid data (free) when there is no register yet:
 *     the last sale's freehold/leasehold flag fills an unknown tenure.
 *
 * Proprietor names are never copied: they are personal data and stay in the
 * GDPR-fenced register store. Only property facts reach the listing.
 */
import type { PropertyListing, Tenure } from '@/types/listing.types';
import type { HmlrRegisterExtract } from './hmlrTitle.service';
import { hmlrTitleService, splitAddressLine1 } from './hmlrTitle.service';
import {
  createDefaultLandRegistryAddress,
  fetchPriceHistory,
  findExactPropertyMatch,
  isValidPostcode,
  type PricePaidRecord,
} from './landRegistryService';
import { splitAddress } from '@/utils/addressSplit';
import { storeRightmoveData } from '@/utils/rightmoveStorage';

export type FactField = 'tenure' | 'postcode';

/** A register value that contradicts what the listing holds. */
export interface FactDiscrepancy {
  field: FactField;
  listing: string;
  register: string;
  source: 'hmlr-register';
}

export interface FactsResult {
  listing: PropertyListing;
  changed: boolean;
  discrepancies: FactDiscrepancy[];
}

/** HMLR tenure label ("Freehold", "Leasehold", "Commonhold"...) → listing tenure. */
export function normaliseRegisterTenure(raw: string | null | undefined): Tenure | null {
  const t = (raw ?? '').trim().toLowerCase();
  if (t === 'freehold') return 'freehold';
  if (t === 'leasehold') return 'leasehold';
  return null;
}

/** Price-paid duration code (F/L) → listing tenure. */
export function normalisePricePaidTenure(duration: string | null | undefined): Tenure | null {
  const d = (duration ?? '').trim().toUpperCase();
  if (d === 'F') return 'freehold';
  if (d === 'L') return 'leasehold';
  return null;
}

function normalisePostcode(pc: string): string {
  return pc.replace(/\s+/g, '').toUpperCase();
}

/** Share of freehold is registered as leasehold; that is agreement, not a clash. */
function tenuresAgree(listing: Tenure, register: Tenure): boolean {
  if (listing === register) return true;
  return listing === 'shareOfFreehold' && register === 'leasehold';
}

/**
 * Pure step: apply the HMLR register to the listing. Fills a blank tenure
 * and a blank structured address line; reports tenure and postcode clashes.
 */
export function applyRegisterFacts(
  listing: PropertyListing,
  register: HmlrRegisterExtract,
): FactsResult {
  const next: PropertyListing = { ...listing, provenance: { ...listing.provenance } };
  const discrepancies: FactDiscrepancy[] = [];
  let changed = false;

  const tenure = normaliseRegisterTenure(register.tenure);
  if (tenure) {
    if (listing.tenure === 'unknown') {
      next.tenure = tenure;
      next.provenance.tenure = 'hmlr-register';
      changed = true;
    } else if (!tenuresAgree(listing.tenure, tenure)) {
      discrepancies.push({ field: 'tenure', listing: listing.tenure, register: tenure, source: 'hmlr-register' });
    }
  }

  const registered = splitAddress(register.registeredAddress);
  const listingPostcode = normalisePostcode(listing.postcode);
  const registerPostcode = registered.postcode ? normalisePostcode(registered.postcode) : '';
  if (registerPostcode && listingPostcode && listingPostcode !== registerPostcode) {
    // An outcode-only value on either side ("SK10") is a partial, not a clash.
    const isPartial = registerPostcode.startsWith(listingPostcode) || listingPostcode.startsWith(registerPostcode);
    if (!isPartial) {
      discrepancies.push({
        field: 'postcode',
        listing: listing.postcode,
        register: registered.postcode ?? '',
        source: 'hmlr-register',
      });
    }
  }

  if (!(listing.addressLine1 ?? '').trim() && registered.line1) {
    next.addressLine1 = registered.line1;
    next.provenance.addressLine1 = 'hmlr-register';
    changed = true;
  }

  return { listing: changed ? next : listing, changed, discrepancies };
}

/** Pure step: fill an unknown tenure from the last price-paid sale. */
export function applyPricePaidTenure(listing: PropertyListing, record: PricePaidRecord | null): FactsResult {
  const tenure = normalisePricePaidTenure(record?.duration);
  if (!tenure || listing.tenure !== 'unknown') return { listing, changed: false, discrepancies: [] };
  const next: PropertyListing = {
    ...listing,
    tenure,
    provenance: { ...listing.provenance, tenure: 'land-registry-ppd' },
  };
  return { listing: next, changed: true, discrepancies: [] };
}

/** The most recent price-paid sale that matches this listing's house and street. */
export async function findLastSaleForListing(listing: PropertyListing): Promise<PricePaidRecord | null> {
  if (!isValidPostcode(listing.postcode)) return null;
  const line1 = (listing.addressLine1 ?? '').trim() || splitAddress(listing.address).line1;
  const parts = splitAddressLine1(line1);
  const paon = parts.houseNumber ?? parts.houseName ?? '';
  if (!paon) return null;
  const history = await fetchPriceHistory(listing.postcode);
  if (!history.success) return null;
  const address = { ...createDefaultLandRegistryAddress(), paon, street: parts.streetName ?? '' };
  const matches = findExactPropertyMatch(history.records, address);
  return matches[0] ?? null;
}

async function swallow<T>(work: Promise<T>, fallback: T): Promise<T> {
  try {
    return await work;
  } catch {
    return fallback;
  }
}

/**
 * Apply whichever register we hold, persist when anything was filled, and
 * hand back the discrepancies for the sales pack to show. Persisting goes
 * through the chain write, which the transaction manager records as a
 * `listing_updated` audit event; the listing JSON carries per-field
 * provenance so the trail shows where each fact came from.
 */
export async function enrichListingFromRegisters(
  transactionId: string,
  listing: PropertyListing,
): Promise<FactsResult> {
  const register = await swallow(hmlrTitleService.getStoredRegisterForTransaction(transactionId), null);
  let result: FactsResult;
  if (register) {
    result = applyRegisterFacts(listing, register);
  } else if (listing.tenure === 'unknown') {
    const sale = await swallow(findLastSaleForListing(listing), null);
    result = applyPricePaidTenure(listing, sale);
  } else {
    result = { listing, changed: false, discrepancies: [] };
  }
  if (result.changed) await swallow(storeRightmoveData(transactionId, result.listing), { ok: false });
  return result;
}
