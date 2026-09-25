// Candid-side mirror of the TA6 6th-edition schema — foundational variants
// and shared records. The transaction_manager actor is untyped in the
// consumer, so these types replicate the generated core-client declarations
// (transaction_manager.did.d.ts) BY CONSTRUCTION — if the canister interface
// changes, update here and in the mappers together.
//
// Optionals are candid opt encoding: [] | [T]. Money is bigint (pence).
// Timestamps are bigint nanoseconds (Motoko Time.now()).
// Section records + master record live in ta6Candid.types.ts (300-line cap).

export type CandidOpt<T> = [] | [T];

// ---------- Variants ----------

export type CandidTA6Answer =
  | { No: null }
  | { Yes: null }
  | { NotApplicable: null }
  | { NotKnown: null }
  | { NotAnswered: null };

export type CandidTA6Document =
  | { NotApplicable: null }
  | { NotAvailable: null }
  | { NotAnswered: null }
  | { Attached: bigint }
  | { ToFollow: null };

export type CandidJurisdiction = { Wales: null } | { England: null };

export type CandidSellerRole =
  | { Administrator: null }
  | { Executor: null }
  | { Seller: null }
  | { Trustee: null }
  | { Attorney: null };

export type CandidBoundaryOwnership =
  | { NotKnown: null }
  | { Shared: null }
  | { OwnedBySeller: null }
  | { OwnedByNeighbour: null };

export type CandidParkingType =
  | { OnRoad: null }
  | { None: null }
  | { Permit: null }
  | { Garage: null }
  | { Other: null }
  | { Allocated: null }
  | { Driveway: null };

export type CandidHeatingType =
  | { Lpg: null }
  | { Oil: null }
  | { SolarThermal: null }
  | { SolidFuel: null }
  | { DistrictHeating: null }
  | { Electric: null }
  | { HeatPumpAir: null }
  | { Other: null }
  | { GasCentral: null }
  | { HeatPumpGround: null };

export type CandidSewerageSource =
  | { SewageTreatmentPlant: null }
  | { Mains: null }
  | { SepticTank: null }
  | { Other: null }
  | { Cesspool: null };

export type CandidDischargeType = { GroundWater: null } | { SurfaceWater: null };

export type CandidSeverity = { Info: null } | { Warning: null } | { Conflict: null };

// ---------- Shared records ----------

export interface CandidTA6Response {
  answer: CandidTA6Answer;
  details: CandidOpt<string>;
}

export interface CandidWarrantyItem {
  present: CandidTA6Answer;
  document: CandidTA6Document;
}

export interface CandidServiceConnection {
  provider: CandidOpt<string>;
  connected: CandidTA6Answer;
}

export interface CandidMeteredConnection {
  provider: CandidOpt<string>;
  supplyNumber: CandidOpt<string>;
  meterLocation: CandidOpt<string>;
  connected: CandidTA6Answer;
}

export interface CandidWaterConnection {
  provider: CandidOpt<string>;
  stopcockLocation: CandidOpt<string>;
  meterLocation: CandidOpt<string>;
  connected: CandidTA6Answer;
}

export interface CandidServicedPlantConnection {
  provider: CandidOpt<string>;
  serviceProvider: CandidOpt<string>;
  connected: CandidTA6Answer;
  makeModel: CandidOpt<string>;
}

// ---------- Cross-reference anomalies ----------

export interface CandidAnomaly {
  ref: string;
  explanation: string;
  detectedAt: bigint;
  sources: string[];
  severity: CandidSeverity;
}
