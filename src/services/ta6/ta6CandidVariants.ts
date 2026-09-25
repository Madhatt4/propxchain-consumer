// UI-string-union <-> candid-variant lookup tables for the TA6 6th-edition
// mapping. Forward tables are declared once; inverse tables are derived from
// them (keyed by the candid variant tag), so the two directions cannot drift.

import type {
  TA6AnswerValue,
  TA6BoundaryOwnership,
  TA6DischargeType,
  TA6DocumentStatus,
  TA6HeatingType,
  TA6Jurisdiction,
  TA6ParkingType,
  TA6SellerRole,
  TA6SewerageSource,
} from '../../types/ta6.types';
import type {
  CandidBoundaryOwnership,
  CandidDischargeType,
  CandidHeatingType,
  CandidJurisdiction,
  CandidParkingType,
  CandidSellerRole,
  CandidSewerageSource,
  CandidTA6Answer,
  CandidTA6Document,
} from './ta6CandidBase.types';

/** Tag of a single-key candid variant object (e.g. { Yes: null } -> 'Yes'). */
export function candidVariantTag(variant: object): string {
  return Object.keys(variant)[0];
}

function inverseByTag<K extends string>(table: Record<K, object>): Record<string, K> {
  const out: Record<string, K> = {};
  for (const key of Object.keys(table) as K[]) {
    out[candidVariantTag(table[key])] = key;
  }
  return out;
}

// ---------- Forward (UI -> candid) ----------

export const ANSWER_TO_CANDID: Record<TA6AnswerValue, CandidTA6Answer> = {
  yes: { Yes: null },
  no: { No: null },
  'not-known': { NotKnown: null },
  'not-applicable': { NotApplicable: null },
  'not-answered': { NotAnswered: null },
};

// 'attached' is handled separately (carries a documentId payload).
export const DOCUMENT_STATUS_TO_CANDID: Record<
  Exclude<TA6DocumentStatus, 'attached'>,
  CandidTA6Document
> = {
  'to-follow': { ToFollow: null },
  'not-applicable': { NotApplicable: null },
  'not-available': { NotAvailable: null },
  'not-answered': { NotAnswered: null },
};

export const JURISDICTION_TO_CANDID: Record<TA6Jurisdiction, CandidJurisdiction> = {
  england: { England: null },
  wales: { Wales: null },
};

export const SELLER_ROLE_TO_CANDID: Record<TA6SellerRole, CandidSellerRole> = {
  seller: { Seller: null },
  executor: { Executor: null },
  administrator: { Administrator: null },
  attorney: { Attorney: null },
  trustee: { Trustee: null },
};

export const BOUNDARY_OWNERSHIP_TO_CANDID: Record<TA6BoundaryOwnership, CandidBoundaryOwnership> = {
  'owned-by-seller': { OwnedBySeller: null },
  shared: { Shared: null },
  'owned-by-neighbour': { OwnedByNeighbour: null },
  'not-known': { NotKnown: null },
};

export const PARKING_TO_CANDID: Record<TA6ParkingType, CandidParkingType> = {
  garage: { Garage: null },
  driveway: { Driveway: null },
  allocated: { Allocated: null },
  'on-road': { OnRoad: null },
  permit: { Permit: null },
  none: { None: null },
  other: { Other: null },
};

export const HEATING_TO_CANDID: Record<TA6HeatingType, CandidHeatingType> = {
  'gas-central': { GasCentral: null },
  oil: { Oil: null },
  lpg: { Lpg: null },
  electric: { Electric: null },
  'heat-pump-air': { HeatPumpAir: null },
  'heat-pump-ground': { HeatPumpGround: null },
  'solid-fuel': { SolidFuel: null },
  'solar-thermal': { SolarThermal: null },
  'district-heating': { DistrictHeating: null },
  other: { Other: null },
};

export const SEWERAGE_TO_CANDID: Record<TA6SewerageSource, CandidSewerageSource> = {
  mains: { Mains: null },
  'septic-tank': { SepticTank: null },
  cesspool: { Cesspool: null },
  'sewage-treatment-plant': { SewageTreatmentPlant: null },
  other: { Other: null },
};

export const DISCHARGE_TO_CANDID: Record<TA6DischargeType, CandidDischargeType> = {
  'ground-water': { GroundWater: null },
  'surface-water': { SurfaceWater: null },
};

// ---------- Inverse (candid tag -> UI), derived ----------

export const ANSWER_FROM_TAG = inverseByTag(ANSWER_TO_CANDID);
export const DOCUMENT_STATUS_FROM_TAG = inverseByTag(DOCUMENT_STATUS_TO_CANDID);
export const JURISDICTION_FROM_TAG = inverseByTag(JURISDICTION_TO_CANDID);
export const SELLER_ROLE_FROM_TAG = inverseByTag(SELLER_ROLE_TO_CANDID);
export const BOUNDARY_OWNERSHIP_FROM_TAG = inverseByTag(BOUNDARY_OWNERSHIP_TO_CANDID);
export const PARKING_FROM_TAG = inverseByTag(PARKING_TO_CANDID);
export const HEATING_FROM_TAG = inverseByTag(HEATING_TO_CANDID);
export const SEWERAGE_FROM_TAG = inverseByTag(SEWERAGE_TO_CANDID);
export const DISCHARGE_FROM_TAG = inverseByTag(DISCHARGE_TO_CANDID);

// Anomaly severity has no UI table pair (read-only), so it is declared inline.
export const SEVERITY_FROM_TAG: Record<string, 'info' | 'warning' | 'conflict'> = {
  Info: 'info',
  Warning: 'warning',
  Conflict: 'conflict',
};
