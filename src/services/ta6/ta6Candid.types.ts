// Candid-side mirror of the TA6 6th-edition schema — the 15 section records
// and master record. Foundational variants + shared records live in
// ta6CandidBase.types.ts (300-line cap). Both replicate the generated
// core-client declarations (transaction_manager.did.d.ts) BY CONSTRUCTION.

import type { Principal } from '@propxchain/core-client';

import type {
  CandidOpt,
  CandidTA6Answer,
  CandidTA6Document,
  CandidTA6Response,
  CandidJurisdiction,
  CandidSellerRole,
  CandidBoundaryOwnership,
  CandidParkingType,
  CandidHeatingType,
  CandidSewerageSource,
  CandidDischargeType,
  CandidWarrantyItem,
  CandidServiceConnection,
  CandidMeteredConnection,
  CandidWaterConnection,
  CandidServicedPlantConnection,
} from './ta6CandidBase.types';

export * from './ta6CandidBase.types';

// ---------- Section records ----------

export interface CandidSellerParty {
  role: CandidSellerRole;
  fullName: string;
  ownershipOrAuthorityDate: CandidOpt<string>;
}

export interface CandidCompanySeller {
  countryOfIncorporation: string;
  director: string;
  companyNumber: string;
  companyName: string;
}

export interface CandidSolicitorContact {
  postcode: string;
  contactName: string;
  firmName: string;
  email: CandidOpt<string>;
  address: string;
  phone: CandidOpt<string>;
}

export interface CandidSection1PropertyAndSeller {
  postcode: string;
  uprn: CandidOpt<string>;
  solicitor: CandidSolicitorContact;
  propertyAddress: string;
  sellers: CandidSellerParty[];
  sellerCompany: CandidOpt<CandidCompanySeller>;
}

export interface CandidBoundaryFeature {
  ownership: CandidBoundaryOwnership;
  position: string;
}

export interface CandidSection2Boundaries {
  q2_3MovedOrAltered: CandidTA6Response;
  q2_2IrregularDescription: CandidOpt<string>;
  q2_1Features: CandidBoundaryFeature[];
}

export interface CandidSection3Disputes {
  q3_2PotentialDisputes: CandidTA6Response;
  q3_1ExistingDisputes: CandidTA6Response;
}

export interface CandidSection4Notices {
  q4_2NearbyDevelopment: CandidTA6Response;
  q4_1NoticesReceived: CandidTA6Response;
  q4_3NearbyUseChange: CandidTA6Response;
}

export interface CandidAlterationTypes {
  conservatory: boolean;
  otherDetails: CandidOpt<string>;
  other: boolean;
  changeOfUse: boolean;
  structuralRoofWorks: boolean;
  windowsPost2002: boolean;
  internalWallsRemoved: boolean;
  loftConversion: boolean;
  garageConversion: boolean;
  extension: boolean;
}

export interface CandidSolarPower {
  supplyAgreement: CandidTA6Document;
  ownedOutright: CandidOpt<boolean>;
  mcsCertificate: CandidTA6Document;
  installDate: CandidOpt<string>;
  electricityBill: CandidTA6Document;
  fitOrSegAgreement: CandidTA6Document;
}

export interface CandidSection5Alterations {
  q5_6Solar: CandidOpt<CandidSolarPower>;
  q5_3NonResidentialUse: CandidTA6Response;
  q5_8ConservationArea: CandidTA6Response;
  q5_9TreePreservationOrder: CandidTA6Response;
  q5_2Documents: CandidTA6Document[];
  q5_4Breaches: CandidTA6Response;
  q5_5UnresolvedIssues: CandidTA6Response;
  q5_1Alterations: CandidAlterationTypes;
  q5_7ListedBuilding: CandidTA6Response;
}

export interface CandidSection6Guarantees {
  q6_1CentralHeating: CandidWarrantyItem;
  q6_3Breaches: CandidTA6Response;
  q6_1DampProofing: CandidWarrantyItem;
  q6_1Roofing: CandidWarrantyItem;
  q6_1NewHomeWarranty: CandidWarrantyItem;
  q6_1ElectricalWork: CandidWarrantyItem;
  q6_1WindowsDoors: CandidWarrantyItem;
  q6_1Underpinning: CandidWarrantyItem;
  q6_1TimberTreatment: CandidWarrantyItem;
  q6_1OtherDetails: CandidOpt<string>;
  q6_2Claims: CandidTA6Response;
  q6_1Other: CandidWarrantyItem;
}

export interface CandidSection7Insurance {
  q7_2DifficultOrSpecialConditions: CandidTA6Response;
  q7_1DoYouInsure: CandidTA6Answer;
  q7_1WhoInsuresIfNot: CandidOpt<string>;
  q7_3Claims: CandidTA6Response;
}

export interface CandidSection8Environmental {
  q8_5GreenDeal: CandidTA6Response;
  q8_6JapaneseKnotweed: CandidTA6Response;
  q8_5CurrentBill: CandidTA6Document;
  q8_3bBelowActionLevel: CandidTA6Answer;
  q8_4RadonRemedialMeasures: CandidTA6Response;
  q8_7SurveyDocument: CandidTA6Document;
  q8_3aReport: CandidTA6Document;
  q8_3RadonTest: CandidTA6Response;
  q8_7KnotweedSurvey: CandidTA6Answer;
  q8_1Flooded: CandidTA6Response;
  q8_2FloodDefences: CandidTA6Response;
}

export interface CandidRight {
  overProperty: CandidOpt<string>;
  description: string;
}

export interface CandidArrangement {
  description: string;
  document: CandidTA6Document;
  contributionAmount: CandidOpt<bigint>;
}

export interface CandidSection9Rights {
  q9_4Rights: CandidRight[];
  q9_9Arrangement: CandidOpt<CandidArrangement>;
  q9_1RightsExercised: CandidTA6Response;
  q9_4OthersRights: CandidTA6Response;
  q9_2Amount: CandidOpt<bigint>;
  q9_8LeadingToOthers: CandidTA6Response;
  q9_7CrossingOtherProperty: CandidTA6Response;
  q9_5ContributionsReceived: CandidTA6Response;
  q9_1Rights: CandidRight[];
  q9_3Disagreements: CandidTA6Response;
  q9_5Amount: CandidOpt<bigint>;
  q9_2Contributions: CandidTA6Response;
  q9_6Disagreements: CandidTA6Response;
}

export interface CandidSection10Parking {
  q10_3InstallConsent: CandidTA6Document;
  q10_1Details: CandidOpt<string>;
  q10_1Arrangements: CandidParkingType[];
  q10_2PermitRequired: CandidTA6Response;
  q10_3EvChargingPoint: CandidTA6Response;
}

export interface CandidHeatingSystem {
  certificate: CandidTA6Document;
  otherDetails: CandidOpt<string>;
  installDate: CandidOpt<string>;
  heatingType: CandidHeatingType;
  lastServiceDate: CandidOpt<string>;
}

export interface CandidSewerageSystem {
  otherDetails: CandidOpt<string>;
  source: CandidSewerageSource;
  infiltrationSystem: CandidTA6Answer;
  lastServiceDate: CandidOpt<string>;
  regulationCompliant: CandidTA6Answer;
  location: CandidOpt<string>;
  dischargeType: CandidOpt<CandidDischargeType>;
}

export interface CandidSection11Services {
  q11_2Document: CandidTA6Document;
  q11_5bSurfaceWaterMains: CandidTA6Answer;
  q11_4HeatingSystems: CandidHeatingSystem[];
  q11_3Date: CandidOpt<string>;
  q11_3Eicr: CandidTA6Answer;
  q11_6SewerageSource: CandidOpt<CandidSewerageSource>;
  q11_1ElectricalWorks: CandidTA6Response;
  q11_5aFoulWaterMains: CandidTA6Answer;
  q11_2ElectricalCertificates: CandidTA6Answer;
  q11_3Report: CandidTA6Document;
  q11_7SewerageSystem: CandidOpt<CandidSewerageSystem>;
}

export interface CandidSection12Connections {
  sharedHeatPumps: CandidServicedPlantConnection;
  mainsWater: CandidWaterConnection;
  mainsGas: CandidMeteredConnection;
  smallSewageTreatmentPlant: CandidServicedPlantConnection;
  mainsSewerage: CandidServiceConnection;
  telephone: CandidServiceConnection;
  broadband: CandidServiceConnection;
  otherServices: CandidOpt<string>;
  mainsElectricity: CandidMeteredConnection;
}

export interface CandidOccupier {
  age: CandidOpt<bigint>;
  fullName: string;
  tenancyAgreement: CandidTA6Document;
}

export interface CandidSection13Transaction {
  q13_5VacantPossession: CandidTA6Answer;
  q13_4OtherOccupiers17Plus: CandidTA6Response;
  q13_4bTenantsOrLodgers: CandidTA6Answer;
  q13_1DependentPurchase: CandidTA6Response;
  q13_7Occupiers: CandidOccupier[];
  q13_6OccupiersAgreedSignVacate: CandidTA6Answer;
  q13_3SellerLivesAtProperty: CandidTA6Answer;
  q13_2MovingDateRequirements: CandidTA6Response;
}

export interface CandidCompletionCommitments {
  removeSellersItems: CandidTA6Answer;
  vacantPossession: CandidTA6Answer;
  leaveServiceInfo: CandidTA6Answer;
}

export interface CandidSection14Completion {
  q14_2Commitments: CandidCompletionCommitments;
  q14_1ProceedsClearCharges: CandidTA6Response;
}

export interface CandidSection15AdditionalInfo {
  additionalNotes: CandidOpt<string>;
  q15_1ConsentsAttached: CandidTA6Document[];
  consentsNotAvailableList: CandidOpt<string>;
  consentsToFollowList: CandidOpt<string>;
  consentsAttachedList: CandidOpt<string>;
}

// ---------- Master record ----------

export interface CandidTA6PropertyInformation {
  completedAt: CandidOpt<bigint>;
  completedBy: Principal;
  formVersion: string;
  jurisdiction: CandidJurisdiction;
  section10: CandidSection10Parking;
  section11: CandidSection11Services;
  section12: CandidSection12Connections;
  section13: CandidSection13Transaction;
  section14: CandidSection14Completion;
  section15: CandidSection15AdditionalInfo;
  lastModifiedAt: bigint;
  lastModifiedBy: Principal;
  section1: CandidSection1PropertyAndSeller;
  section2: CandidSection2Boundaries;
  section3: CandidSection3Disputes;
  section4: CandidSection4Notices;
  section5: CandidSection5Alterations;
  section6: CandidSection6Guarantees;
  section7: CandidSection7Insurance;
  section8: CandidSection8Environmental;
  section9: CandidSection9Rights;
}
