// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

export type MaterialInfoSource = 'listing' | 'epc' | 'agent' | 'missing';
export interface MaterialInfoField<T> { value: T | null; source: MaterialInfoSource }
export interface MaterialInfo {
  price: MaterialInfoField<number>;
  tenure: MaterialInfoField<string>;
  councilTaxBand: MaterialInfoField<string>;
  epcRating: MaterialInfoField<string>;
  epcFloorAreaSqm: MaterialInfoField<number>;
  leaseYearsRemaining: MaterialInfoField<number>;
  groundRentPerYear: MaterialInfoField<number>;
  serviceChargePerYear: MaterialInfoField<number>;
  floodRisk: MaterialInfoField<string>;
  conservationArea: MaterialInfoField<boolean>;
  listedBuilding: MaterialInfoField<string>;
}
export type MaterialInfoKey = keyof MaterialInfo;
/** Agent-entered overrides: only the fields an agent may type by hand in v1. */
export type MaterialInfoOverrides = Partial<{
  councilTaxBand: string; leaseYearsRemaining: number; groundRentPerYear: number;
  serviceChargePerYear: number; floodRisk: string; conservationArea: boolean; listedBuilding: string;
}>;
