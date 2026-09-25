// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Property logbook domain types + plain-English entry formatting.
 * The logbook is an append-only, UPRN-keyed record created free at completion
 * and owned by the homeowner's principal. v1 renders from `entries` only —
 * the canister's DerivedState is intentionally not consumed yet.
 */

export type LogbookEvidence = 'onchainAnchor' | 'sellerVouch' | 'systemDerived';
export type TenureKind = 'freehold' | 'leasehold' | 'shareOfFreehold';
export type PriceEventKind = 'listed' | 'sold';
export type MilestoneKind = 'listed' | 'saleAgreed' | 'completed';

export type LogbookClaim =
  | {
      kind: 'propertyIdentity';
      uprn: string;
      addressLine: string;
      postcode: string;
      propertyType: string;
    }
  | {
      kind: 'titleFacts';
      titleNumber: string;
      classOfTitle: string | null;
      editionDate: string | null;
      hasCharges: boolean | null;
      hasRestrictions: boolean | null;
    }
  | {
      kind: 'tenure';
      tenure: TenureKind;
      leaseYearsRemaining: bigint | null;
      groundRentPerYearPence: bigint | null;
      serviceChargePerYearPence: bigint | null;
    }
  | {
      kind: 'ratings';
      epcBand: string | null;
      epcCertRef: string | null;
      councilTaxBand: string | null;
    }
  | { kind: 'priceEvent'; priceKind: PriceEventKind; pricePence: bigint; occurredAt: bigint }
  | {
      kind: 'searchFact';
      provider: string;
      productCodes: string[];
      orderedAt: bigint | null;
      resultsReturnedAt: bigint | null;
      resultHashes: string[];
    }
  | {
      kind: 'documentAnchor';
      docType: string;
      sha256: string;
      validUntil: bigint | null;
      anchoredAt: bigint;
    }
  | { kind: 'milestone'; milestoneKind: MilestoneKind; transactionId: string; occurredAt: bigint };

export interface LogbookEntry {
  id: bigint;
  claim: LogbookClaim;
  recordedAt: bigint;
  recordedByTransaction: string | null;
  evidence: LogbookEvidence;
}

export interface Logbook {
  uprn: string;
  /** Owner principal, as text. */
  owner: string;
  createdAt: bigint;
  entries: LogbookEntry[];
}

/** Canister timestamps are Motoko `Time.now()` — nanoseconds since epoch. */
export function logbookTimeToDate(t: bigint): Date {
  return new Date(Number(t / 1_000_000n));
}

export function formatLogbookDate(t: bigint): string {
  return logbookTimeToDate(t).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatPricePence(pence: bigint): string {
  const wholePounds = pence % 100n === 0n;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: wholePounds ? 0 : 2,
    maximumFractionDigits: wholePounds ? 0 : 2,
  }).format(Number(pence) / 100);
}

const TENURE_LABEL: Record<TenureKind, string> = {
  freehold: 'Freehold',
  leasehold: 'Leasehold',
  shareOfFreehold: 'Share of freehold',
};

const MILESTONE_LABEL: Record<MilestoneKind, string> = {
  listed: 'Listed for sale',
  saleAgreed: 'Sale agreed',
  completed: 'Purchase completed',
};

export const EVIDENCE_LABEL: Record<LogbookEvidence, string> = {
  onchainAnchor: 'Record held on the Internet Computer',
  sellerVouch: 'Vouched by the seller',
  systemDerived: 'Recorded automatically by PropXchain',
};

/** One plain-English line per claim kind, e.g. "Sold for £400,000 · 14 Aug 2026". */
export function describeEntry(entry: LogbookEntry): string {
  const claim = entry.claim;
  switch (claim.kind) {
    case 'propertyIdentity':
      return `Property recorded — ${claim.addressLine}, ${claim.postcode} (${claim.propertyType})`;
    case 'titleFacts':
      return `Title ${claim.titleNumber} recorded${
        claim.classOfTitle ? ` — ${claim.classOfTitle} title` : ''
      }`;
    case 'tenure': {
      const years =
        claim.tenure === 'leasehold' && claim.leaseYearsRemaining !== null
          ? `, ${claim.leaseYearsRemaining} years remaining`
          : '';
      return `Tenure recorded — ${TENURE_LABEL[claim.tenure]}${years}`;
    }
    case 'ratings': {
      const parts: string[] = [];
      if (claim.epcBand) parts.push(`EPC band ${claim.epcBand}`);
      if (claim.councilTaxBand) parts.push(`council tax band ${claim.councilTaxBand}`);
      return parts.length > 0 ? `Ratings recorded — ${parts.join(' · ')}` : 'Ratings recorded';
    }
    case 'priceEvent':
      return `${claim.priceKind === 'sold' ? 'Sold' : 'Listed'} for ${formatPricePence(
        claim.pricePence,
      )} · ${formatLogbookDate(claim.occurredAt)}`;
    case 'searchFact': {
      const codes = claim.productCodes.join(', ');
      const verb = claim.resultsReturnedAt !== null ? 'returned' : 'ordered';
      return `Searches ${verb} — ${claim.provider}${codes ? ` ${codes}` : ''}`;
    }
    case 'documentAnchor':
      return `${claim.docType} anchored · SHA-256 …${claim.sha256.slice(-4)}`;
    case 'milestone':
      return `${MILESTONE_LABEL[claim.milestoneKind]} · ${formatLogbookDate(claim.occurredAt)}`;
  }
}
