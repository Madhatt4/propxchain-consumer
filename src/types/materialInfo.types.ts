// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

export type MaterialInfoSource = 'listing' | 'epc' | 'seller' | 'agent' | 'missing';
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
  // NTS Part B: physical characteristics, utilities and connectivity
  propertyType: MaterialInfoField<string>;
  bedrooms: MaterialInfoField<number>;
  bathrooms: MaterialInfoField<number>;
  electricity: MaterialInfoField<string>;
  water: MaterialInfoField<string>;
  sewerage: MaterialInfoField<string>;
  heating: MaterialInfoField<string>;
  broadband: MaterialInfoField<string>;
  mobileSignal: MaterialInfoField<string>;
  parking: MaterialInfoField<string>;
  floodRisk: MaterialInfoField<string>;
  conservationArea: MaterialInfoField<boolean>;
  listedBuilding: MaterialInfoField<string>;
}
export type MaterialInfoKey = keyof MaterialInfo;
/** Agent-entered overrides: only the fields an agent may type by hand in v1. */
export type MaterialInfoOverrides = Partial<{
  councilTaxBand: string; leaseYearsRemaining: number; groundRentPerYear: number;
  serviceChargePerYear: number; floodRisk: string; conservationArea: boolean; listedBuilding: string;
  electricity: string; water: string; sewerage: string; heating: string; broadband: string;
  mobileSignal: string; parking: string;
}>;
/** Part B values read from the seller's TA6 answers (sections 10–12). */
export type SellerPartB = Partial<Record<'electricity' | 'water' | 'sewerage' | 'heating' | 'broadband' | 'parking', string>>;
