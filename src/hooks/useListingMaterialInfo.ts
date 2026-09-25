// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Merges a listing's own facts, its EPC certificate and the agent's manual
 * overrides into one `MaterialInfo` view for the detail page and its public
 * counterpart.
 */

import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { lookupEpc } from '@/services/epc.service';
import { buildMaterialInfo, emptyMaterialInfo, normalizeMaterialInfo } from '@/utils/materialInfo';
import type { AgentListingRow } from '@/types/estateAgentListing.types';
import type { MaterialInfo, MaterialInfoOverrides } from '@/types/materialInfo.types';
import type { EpcCertificate } from '@/services/epc.service';

/** The only fields an agent may hand-enter — the fields `MaterialInfoOverrides`
 *  actually carries. Kept in sync with that type by hand since a `keyof`
 *  can't be turned into a runtime array. */
const OVERRIDE_KEYS: readonly (keyof MaterialInfoOverrides)[] = [
  'councilTaxBand',
  'leaseYearsRemaining',
  'groundRentPerYear',
  'serviceChargePerYear',
  'floodRisk',
  'conservationArea',
  'listedBuilding',
];

/** Copies one field's value into the overrides object if the merged view says
 *  it came from the agent. The cast is narrow and field-scoped — TS can't
 *  correlate a union-typed loop key with its own field's value type, but the
 *  key/value pair here are always the matching pair for one `K`. */
function seedOverrideField<K extends keyof MaterialInfoOverrides>(
  overrides: MaterialInfoOverrides,
  key: K,
  field: MaterialInfo[K],
): void {
  if (field.source === 'agent' && field.value !== null) {
    overrides[key] = field.value as MaterialInfoOverrides[K];
  }
}

/** Rebuild the agent-entered overrides from a listing's saved `material_info`:
 *  only the fields whose current source is `'agent'` survive a reload. */
function seedOverrides(info: MaterialInfo): MaterialInfoOverrides {
  const overrides: MaterialInfoOverrides = {};
  OVERRIDE_KEYS.forEach((key) => seedOverrideField(overrides, key, info[key]));
  return overrides;
}

export interface UseListingMaterialInfoResult {
  info: MaterialInfo;
  overrides: MaterialInfoOverrides;
  setOverrides: (next: MaterialInfoOverrides) => void;
  epc: EpcCertificate | null;
  epcLoading: boolean;
}

/** Loads the EPC certificate for a listing row (once per row id) and merges
 *  it with the listing's facts and any agent overrides. */
export function useListingMaterialInfo(row: AgentListingRow | null): UseListingMaterialInfoResult {
  const [overrides, setOverrides] = useState<MaterialInfoOverrides>({});

  useEffect(() => {
    // `row.material_info` can be a partially-shaped `{}` for a brand-new
    // row (that's the DB column default) — normalize before reading fields
    // off it, or a missing key here throws instead of seeding "not set".
    if (row) setOverrides(seedOverrides(normalizeMaterialInfo(row.material_info)));
  }, [row?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: epc = null, isLoading: epcLoading } = useQuery({
    queryKey: ['listing-epc', row?.id],
    enabled: !!row,
    queryFn: () =>
      lookupEpc(row!.listing.postcode, { addressLine: row!.listing.addressLine1 ?? row!.listing.address }),
  });

  const info = useMemo(
    () => (row ? buildMaterialInfo(row.listing, epc, overrides) : emptyMaterialInfo()),
    [row, epc, overrides],
  );

  return { info, overrides, setOverrides, epc, epcLoading };
}
