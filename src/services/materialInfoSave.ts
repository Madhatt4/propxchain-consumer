// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Save the Sales pack's inline "About your property" answers through the same
 * path Stage 1 uses: merge into the stored listing JSON, write it locally and
 * on-chain with storeRightmoveData, and log one `listing_edited` event per
 * changed field so the audit trail matches a Stage 1 edit. No new on-chain
 * fields: every key here already exists on the listing.
 */
import type { PropertyListing, ProvenanceMap, Tenure } from '@/types/listing.types';
import { getRightmoveData, storeRightmoveData } from '@/utils/rightmoveStorage';
import { logger } from '@/utils/logger';
import { icpService } from './icp.service';

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
  saved: boolean;
  /** False when the save reached this device but not the chain. */
  chainOk: boolean;
  error?: string;
}

type PatchKey = keyof MaterialInfoPatch;

function changedKeys(base: PropertyListing, patch: MaterialInfoPatch): PatchKey[] {
  return (Object.keys(patch) as PatchKey[]).filter(
    (k) => patch[k] !== undefined && patch[k] !== base[k],
  );
}

function logEdits(transactionId: string, base: PropertyListing, patch: MaterialInfoPatch, keys: PatchKey[]): void {
  for (const field of keys) {
    const oldValue = base[field] == null ? '' : String(base[field]);
    const newValue = String(patch[field]);
    void icpService.ledgerManager
      ?.logEvent(
        transactionId,
        'listing_edited',
        `${field} updated`,
        [JSON.stringify({ field, oldValue, newValue })],
      )
      .catch((err: unknown) => logger.warn('[salesPack] logEvent failed', err));
  }
}

export async function saveMaterialInfoPatch(
  transactionId: string,
  patch: MaterialInfoPatch,
): Promise<MaterialInfoSaveResult> {
  const base = getRightmoveData(transactionId);
  if (!base) return { saved: false, chainOk: false };
  const keys = changedKeys(base, patch);
  const provenance: ProvenanceMap = { ...base.provenance };
  for (const k of keys) provenance[k] = 'user';
  const defined = Object.fromEntries(keys.map((k) => [k, patch[k]])) as MaterialInfoPatch;
  const merged: PropertyListing = { ...base, ...defined, provenance };
  const chain = await storeRightmoveData(transactionId, merged);
  logEdits(transactionId, base, patch, keys);
  return { saved: true, chainOk: chain.ok, error: chain.error };
}
