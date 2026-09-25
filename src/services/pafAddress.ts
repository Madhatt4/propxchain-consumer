// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Parse a free-text UK property address into the PAF fields PISCES needs.
 *
 * Transactions store `propertyAddress` as a single string, but OneSearch
 * requires a structured PAFAddress and treats a premises identifier
 * (BuildingName or BuildingNumber) and ThoroughfareName as mandatory. An
 * order carrying only a postcode identifies no property, so this is the
 * difference between a search that runs and one that gets rejected.
 *
 * Deliberately conservative: it recognises the common UK address shapes and
 * leaves a field undefined rather than guessing. A missing field is a
 * visible rejection from OneSearch; a wrong one is a search against the
 * wrong property.
 */

import type { PAFAddress } from './onesearch.service';

/** Matches a leading premises number with optional suffix — "10", "10A", "221B". */
const LEADING_NUMBER = /^(\d+[A-Za-z]?)\s+(.*)$/;

/** Sub-building prefixes that indicate a flat rather than a named building. */
const SUB_BUILDING_PREFIXES = ['flat', 'apartment', 'apt', 'unit', 'room', 'suite'];

/** Normalise a UK postcode to its canonical single-spaced uppercase form. */
function normalisePostcode(postcode: string): string {
  const compact = postcode.replace(/\s+/g, '').toUpperCase();
  if (compact.length < 5) return compact;
  return `${compact.slice(0, compact.length - 3)} ${compact.slice(-3)}`;
}

/** True when a line is the postcode repeated inside the address string. */
function isPostcodeLine(line: string, postcode: string): boolean {
  if (!postcode) return false;
  return line.replace(/\s+/g, '').toUpperCase() === postcode.replace(/\s+/g, '').toUpperCase();
}

function isSubBuilding(line: string): boolean {
  const first = line.trim().toLowerCase().split(/\s+/)[0] ?? '';
  return SUB_BUILDING_PREFIXES.includes(first.replace(/[.,]/g, ''));
}

/**
 * Split the premises lines (everything before the post town) into the PAF
 * building fields. `lines` is ordered outermost-last, i.e. as written.
 */
function assignPremises(lines: string[], out: PAFAddress): void {
  if (lines.length === 0) return;

  const streetLine = lines[lines.length - 1];
  const preceding = lines.slice(0, -1);
  const numbered = LEADING_NUMBER.exec(streetLine);

  if (numbered) {
    // "10 Downing Street" → number 10 on Downing Street.
    out.buildingNumber = numbered[1];
    out.thoroughfareName = numbered[2];
  } else if (preceding.length === 0) {
    // A single unnumbered line is a named building with no street of its
    // own — "Buckingham Palace". PISCES wants a thoroughfare too, but
    // inventing one would be worse than letting it reject.
    out.buildingName = streetLine;
    return;
  } else {
    // "The Old Rectory, Church Lane" → named building on a street.
    out.thoroughfareName = streetLine;
  }

  if (preceding.length === 0) return;

  const nearest = preceding[preceding.length - 1];
  if (isSubBuilding(nearest)) {
    out.subBuildingName = nearest;
    if (preceding.length >= 2) out.buildingName = preceding[preceding.length - 2];
    return;
  }

  out.buildingName = nearest;
  if (preceding.length >= 2 && isSubBuilding(preceding[preceding.length - 2])) {
    out.subBuildingName = preceding[preceding.length - 2];
  }
}

/** The structured address fields captured by the List Property form. */
export interface StructuredAddress {
  addressLine1?: string;
  addressLine2?: string;
  town?: string;
  county?: string;
  postcode?: string;
}

/** True when the structured fields carry enough to identify a property. */
export function hasUsableStructuredAddress(parts: StructuredAddress | null | undefined): boolean {
  return Boolean(parts?.addressLine1?.trim());
}

/**
 * Build a PAFAddress from the structured fields the user actually typed.
 *
 * This is the preferred path. The List Property form captures line 1, line 2,
 * town, county and postcode separately, so flattening them into one string
 * and parsing it back is lossy for no reason — and it made correctness depend
 * on the user happening to type commas into fields that never asked for any.
 */
export function pafAddressFromParts(
  parts: StructuredAddress,
  laName = '',
): PAFAddress {
  const line1 = parts.addressLine1?.trim() ?? '';
  const line2 = parts.addressLine2?.trim() ?? '';
  const town = parts.town?.trim() ?? '';
  const county = parts.county?.trim() ?? '';
  const postcode = parts.postcode?.trim() ?? '';
  const normalisedPostcode = postcode ? normalisePostcode(postcode) : '';

  const out: PAFAddress = {
    postCode: normalisedPostcode,
    postTown: town || laName || normalisedPostcode,
  };
  if (county) out.county = county;

  // Line 1 then line 2, in the order written — the same ordering
  // assignPremises expects from a parsed string.
  assignPremises([line1, line2].filter(Boolean), out);

  return out;
}

/**
 * Parse a free-text address into a PAFAddress.
 *
 * Fallback for transactions that only ever stored a flat address string.
 * Prefer pafAddressFromParts whenever the structured fields are available.
 *
 * @param propertyAddress free-text address, comma separated as entered
 * @param postcode the transaction's postcode — authoritative, and used to
 *                 strip a repeated postcode out of the address string
 * @param laName local authority name, used only as a post-town fallback
 */
export function parsePafAddress(
  propertyAddress: string,
  postcode: string,
  laName: string,
): PAFAddress {
  const normalisedPostcode = postcode ? normalisePostcode(postcode) : '';

  const parts = (propertyAddress ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !isPostcodeLine(s, postcode));

  const out: PAFAddress = {
    postCode: normalisedPostcode,
    // Post town is the last line of the address proper. The local authority
    // is only a fallback: it is often not the PAF post town (SW1A 1AA sits
    // in Westminster but posts to LONDON), so prefer the written address.
    postTown: parts.length >= 1 ? parts[parts.length - 1] : laName || normalisedPostcode,
  };

  if (parts.length >= 1) {
    assignPremises(parts.slice(0, -1), out);
  }

  return out;
}
