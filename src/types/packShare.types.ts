// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * The public sales-pack snapshot (decision: Madhatt4/Propxchain#116).
 *
 * This is everything a stranger with the link may see, assembled in the
 * seller's browser (canister reads are principal-gated, so no server can
 * build it) and published to Supabase. GDPR boundary: property facts in
 * full, TA6/TA10 pre-redacted via packRedaction, title summary WITHOUT
 * proprietor names, never anything from the ID/AML wallet slots.
 */
import type { TA6PropertyInformation } from './ta6.types';
import type { TA10FittingsAndContents } from './ta10.types';
import type { PackItemId } from '@/services/salesPackReadiness';

export interface PackItemVerification {
  /** True when the item's record is hash-anchored / held on-chain. */
  verified: boolean;
  /** ISO timestamp of the anchor or last on-chain write, when known. */
  anchoredAt?: string;
  /** One plain-English line, e.g. "SHA-256 anchored on the Internet Computer". */
  note?: string;
}

export interface PackSnapshotItem {
  id: PackItemId;
  label: string;
  done: boolean;
  verification?: PackItemVerification;
}

/** Title register summary — deliberately proprietor-free. */
export interface PackTitleSummary {
  titleNumber: string;
  classOfTitle?: string;
  tenure?: string;
  editionDate?: string;
  hasCharges?: boolean;
  hasRestrictions?: boolean;
}

export interface PackSnapshot {
  version: 1;
  generatedAt: string;
  property: {
    address: string;
    postcode: string;
    price: number;
    tenure: string;
    propertyType: string;
    epcRating: string | null;
    councilTaxBand: string | null;
    uprn?: string;
    leaseYearsRemaining?: number;
    groundRentPerYear?: number;
    serviceChargePerYear?: number;
  } | null;
  items: PackSnapshotItem[];
  titleSummary: PackTitleSummary | null;
  searches: {
    ordered: boolean;
    back: boolean;
    returnedAt?: string;
    productCodes?: string[];
  };
  ta6: TA6PropertyInformation | null;
  ta10: TA10FittingsAndContents | null;
  /** Names only — the bytes stay on the seller's device in this slice.
   *  `kind` is the picker label (Floor plan, EPC certificate, ...); absent
   *  on snapshots taken before the typed picker. */
  extraDocuments: { fileName: string; kind?: string }[];
}

export interface PackShareLink {
  id: string;
  transactionId: string;
  token: string;
  status: 'active' | 'revoked';
  createdAt: string;
  updatedAt: string;
}
