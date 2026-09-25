// TA6 6th-edition section tree — the 15 section interfaces plus their
// section-specific supporting records. Field names mirror the candid schema
// exactly; see ta6.types.ts for conversion conventions and authoritative
// sources. Split from ta6.types.ts to respect the 300-line file cap.

import type {
  TA6AnswerValue,
  TA6ResponseValue,
  TA6DocumentValue,
  TA6SellerRole,
  TA6BoundaryOwnership,
  TA6ParkingType,
  TA6HeatingType,
  TA6SewerageSource,
  TA6DischargeType,
  TA6WarrantyItem,
  TA6ServiceConnection,
  TA6MeteredConnection,
  TA6WaterConnection,
  TA6ServicedPlantConnection,
} from './ta6.types';

// ---------- §1 Property and seller (facts; no not-known answers) ----------

export interface TA6SellerParty {
  fullName: string;
  role: TA6SellerRole;
  ownershipOrAuthorityDate: string | null; // ISO date
}

export interface TA6CompanySeller {
  companyName: string;
  companyNumber: string;
  director: string;
  countryOfIncorporation: string;
}

export interface TA6SolicitorContact {
  firmName: string;
  address: string;
  postcode: string;
  contactName: string;
  email: string | null;
  phone: string | null;
}

export interface TA6Section1PropertyAndSeller {
  propertyAddress: string;
  postcode: string;
  uprn: string | null;
  sellers: TA6SellerParty[];
  sellerCompany: TA6CompanySeller | null;
  solicitor: TA6SolicitorContact;
}

// ---------- §2 Boundaries ----------

export interface TA6BoundaryFeature {
  position: string; // e.g. 'left' / 'right' / 'rear', facing from the road
  ownership: TA6BoundaryOwnership;
}

export interface TA6Section2Boundaries {
  q2_1Features: TA6BoundaryFeature[];
  q2_2IrregularDescription: string | null;
  q2_3MovedOrAltered: TA6ResponseValue;
}

// ---------- §3 Disputes ----------

export interface TA6Section3Disputes {
  q3_1ExistingDisputes: TA6ResponseValue;
  q3_2PotentialDisputes: TA6ResponseValue;
}

// ---------- §4 Notices and proposals ----------

export interface TA6Section4Notices {
  q4_1NoticesReceived: TA6ResponseValue;
  q4_2NearbyDevelopment: TA6ResponseValue;
  q4_3NearbyUseChange: TA6ResponseValue;
}

// ---------- §5 Alterations ----------

// 5.1 tick-all-that-apply alteration types.
export interface TA6AlterationTypes {
  windowsPost2002: boolean;
  conservatory: boolean;
  extension: boolean;
  loftConversion: boolean;
  garageConversion: boolean;
  internalWallsRemoved: boolean;
  changeOfUse: boolean;
  structuralRoofWorks: boolean;
  other: boolean;
  otherDetails: string | null;
}

// 5.6 multi-part follow-up when a solar system is installed.
export interface TA6SolarPower {
  fitOrSegAgreement: TA6DocumentValue;
  supplyAgreement: TA6DocumentValue;
  electricityBill: TA6DocumentValue;
  installDate: string | null; // ISO date
  ownedOutright: boolean | null; // true = owned outright, false = leased
  mcsCertificate: TA6DocumentValue;
}

export interface TA6Section5Alterations {
  q5_1Alterations: TA6AlterationTypes;
  q5_2Documents: TA6DocumentValue[]; // consents for ticked alterations
  q5_3NonResidentialUse: TA6ResponseValue;
  q5_4Breaches: TA6ResponseValue;
  q5_5UnresolvedIssues: TA6ResponseValue;
  q5_6Solar: TA6SolarPower | null; // populated only if a system exists
  q5_7ListedBuilding: TA6ResponseValue; // details = grade
  q5_8ConservationArea: TA6ResponseValue;
  q5_9TreePreservationOrder: TA6ResponseValue;
}

// ---------- §6 Guarantees and warranties ----------

export interface TA6Section6Guarantees {
  q6_1NewHomeWarranty: TA6WarrantyItem; // NHBC etc.
  q6_1DampProofing: TA6WarrantyItem;
  q6_1TimberTreatment: TA6WarrantyItem;
  q6_1Roofing: TA6WarrantyItem;
  q6_1ElectricalWork: TA6WarrantyItem;
  q6_1WindowsDoors: TA6WarrantyItem;
  q6_1CentralHeating: TA6WarrantyItem;
  q6_1Underpinning: TA6WarrantyItem;
  q6_1Other: TA6WarrantyItem;
  q6_1OtherDetails: string | null;
  q6_2Claims: TA6ResponseValue;
  q6_3Breaches: TA6ResponseValue;
}

// ---------- §7 Insurance ----------

export interface TA6Section7Insurance {
  q7_1DoYouInsure: TA6AnswerValue;
  q7_1WhoInsuresIfNot: string | null; // follow-up when not seller-insured
  q7_2DifficultOrSpecialConditions: TA6ResponseValue;
  q7_3Claims: TA6ResponseValue;
}

// ---------- §8 Environmental matters ----------

export interface TA6Section8Environmental {
  q8_1Flooded: TA6ResponseValue; // details = flood type/source
  q8_2FloodDefences: TA6ResponseValue;
  q8_3RadonTest: TA6ResponseValue; // details = results
  q8_3aReport: TA6DocumentValue;
  q8_3bBelowActionLevel: TA6AnswerValue;
  q8_4RadonRemedialMeasures: TA6ResponseValue;
  q8_5GreenDeal: TA6ResponseValue;
  q8_5CurrentBill: TA6DocumentValue; // if Green Deal, current bill
  q8_6JapaneseKnotweed: TA6ResponseValue;
  q8_7KnotweedSurvey: TA6AnswerValue;
  q8_7SurveyDocument: TA6DocumentValue;
}

// ---------- §9 Rights and informal arrangements ----------

export interface TA6Right {
  description: string;
  overProperty: string | null; // which property the right affects
}

export interface TA6Arrangement {
  description: string;
  contributionAmount: number | null; // pence
  document: TA6DocumentValue;
}

export interface TA6Section9Rights {
  // Rights the seller exercises over other property (9.1–9.3)
  q9_1RightsExercised: TA6ResponseValue;
  q9_1Rights: TA6Right[];
  q9_2Contributions: TA6ResponseValue;
  q9_2Amount: number | null; // pence
  q9_3Disagreements: TA6ResponseValue;
  // Rights others exercise over the seller's property (9.4–9.6)
  q9_4OthersRights: TA6ResponseValue;
  q9_4Rights: TA6Right[];
  q9_5ContributionsReceived: TA6ResponseValue;
  q9_5Amount: number | null; // pence
  q9_6Disagreements: TA6ResponseValue;
  // Drains, pipes and wires (9.7–9.9)
  q9_7CrossingOtherProperty: TA6ResponseValue;
  q9_8LeadingToOthers: TA6ResponseValue;
  q9_9Arrangement: TA6Arrangement | null;
}

// ---------- §10 Parking ----------

export interface TA6Section10Parking {
  q10_1Arrangements: TA6ParkingType[];
  q10_1Details: string | null;
  q10_2PermitRequired: TA6ResponseValue;
  q10_3EvChargingPoint: TA6ResponseValue;
  q10_3InstallConsent: TA6DocumentValue;
}

// ---------- §11 Services ----------

// 11.4 multi-instance: one record per heating system.
export interface TA6HeatingSystem {
  heatingType: TA6HeatingType;
  otherDetails: string | null;
  installDate: string | null; // ISO date
  lastServiceDate: string | null; // ISO date
  certificate: TA6DocumentValue;
}

// 11.7 detail required when sewerage is not on mains.
export interface TA6SewerageSystem {
  source: TA6SewerageSource;
  otherDetails: string | null;
  location: string | null;
  lastServiceDate: string | null; // MM/YYYY on the form
  dischargeType: TA6DischargeType | null;
  infiltrationSystem: TA6AnswerValue;
  regulationCompliant: TA6AnswerValue;
}

export interface TA6Section11Services {
  q11_1ElectricalWorks: TA6ResponseValue; // details = date/details
  q11_2ElectricalCertificates: TA6AnswerValue;
  q11_2Document: TA6DocumentValue;
  q11_3Eicr: TA6AnswerValue;
  q11_3Report: TA6DocumentValue;
  q11_3Date: string | null; // ISO date
  q11_4HeatingSystems: TA6HeatingSystem[];
  q11_5aFoulWaterMains: TA6AnswerValue; // foul water drains to mains
  q11_5bSurfaceWaterMains: TA6AnswerValue; // surface water drains to mains
  q11_6SewerageSource: TA6SewerageSource | null; // null = not yet answered
  q11_7SewerageSystem: TA6SewerageSystem | null; // populated when not mains
}

// ---------- §12 Connection to services ----------
// A yes/no grid of service rows (no numbered sub-questions on the form);
// keys are synthetic service names, mirroring the on-chain schema.

export interface TA6Section12Connections {
  mainsElectricity: TA6MeteredConnection;
  mainsGas: TA6MeteredConnection;
  mainsWater: TA6WaterConnection;
  mainsSewerage: TA6ServiceConnection;
  smallSewageTreatmentPlant: TA6ServicedPlantConnection;
  sharedHeatPumps: TA6ServicedPlantConnection;
  telephone: TA6ServiceConnection;
  broadband: TA6ServiceConnection;
  otherServices: string | null;
}

// ---------- §13 Transaction information ----------

export interface TA6Occupier {
  fullName: string;
  age: number | null;
  // 13.7 asks for copies of tenancy agreements; occupier consent is the
  // yes/no at 13.6, not a per-occupier document.
  tenancyAgreement: TA6DocumentValue;
}

export interface TA6Section13Transaction {
  q13_1DependentPurchase: TA6ResponseValue;
  q13_2MovingDateRequirements: TA6ResponseValue;
  q13_3SellerLivesAtProperty: TA6AnswerValue;
  q13_4OtherOccupiers17Plus: TA6ResponseValue; // details list names
  q13_4bTenantsOrLodgers: TA6AnswerValue;
  q13_5VacantPossession: TA6AnswerValue;
  q13_6OccupiersAgreedSignVacate: TA6AnswerValue;
  q13_7Occupiers: TA6Occupier[]; // if not vacant possession
}

// ---------- §14 Completion ----------

export interface TA6CompletionCommitments {
  vacantPossession: TA6AnswerValue;
  removeSellersItems: TA6AnswerValue;
  leaveServiceInfo: TA6AnswerValue;
}

export interface TA6Section14Completion {
  q14_1ProceedsClearCharges: TA6ResponseValue;
  q14_2Commitments: TA6CompletionCommitments;
}

// ---------- §15 Additional information ----------

export interface TA6Section15AdditionalInfo {
  q15_1ConsentsAttached: TA6DocumentValue[];
  consentsAttachedList: string | null;
  consentsToFollowList: string | null;
  consentsNotAvailableList: string | null;
  additionalNotes: string | null;
}
