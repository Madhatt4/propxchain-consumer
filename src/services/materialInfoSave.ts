// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Save the Sales pack's inline "About your property" answers through the same
 * path Stage 1 uses: merge into the stored listing JSON, write it locally and
 * on-chain with storeRightmoveData. The canister's setListingData writes the
 * `listing_updated` audit event itself. No new on-chain fields: every key here
 * already exists on the listing.
 */
import { getRightmoveData, storeRightmoveData } from '@/utils/rightmoveStorage';
import type { PropertyListing, ProvenanceMap, Tenure } from '@/types/listing.types';

export interface MaterialInfoPatch {
  tenure?: Tenure;
  propertyType?: string;
  councilTaxBand?: string;
  leaseYearsRemaining?: number;
  groundRentPerYear?: number;
  serviceChargePerYear?: number;
}

export interface MaterialInfoSaveResult {
  /** False when there was no stored listing to merge into. */
  isSaved: boolean;
  /** False when the save reached this device but not the chain. */
  isChainOk: boolean;
  error?: string;
}

type PatchKey = keyof MaterialInfoPatch;

function changedKeys(base: PropertyListing, patch: MaterialInfoPatch): PatchKey[] {
  return (Object.keys(patch) as PatchKey[]).filter(
    (k) => patch[k] !== undefined && patch[k] !== base[k],
  );
}

export async function saveMaterialInfoPatch(
  transactionId: string,
  patch: MaterialInfoPatch,
): Promise<MaterialInfoSaveResult> {
  const base = getRightmoveData(transactionId);
  if (!base) return { isSaved: false, isChainOk: false };
  const keys = changedKeys(base, patch);
  const provenance: ProvenanceMap = { ...base.provenance };
  for (const k of keys) provenance[k] = 'user';
  const defined = Object.fromEntries(keys.map((k) => [k, patch[k]])) as MaterialInfoPatch;
  const merged: PropertyListing = { ...base, ...defined, provenance };
  const chain = await storeRightmoveData(transactionId, merged);
  return { isSaved: true, isChainOk: chain.ok, error: chain.error };
}
