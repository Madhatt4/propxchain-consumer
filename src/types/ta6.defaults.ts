// TA6 6th-edition defaults + completion metric.
//
// emptyTA6Form(): a fully-draft form — every answer 'not-answered', every
// document slot 'not-answered', arrays empty, optionals null.
//
// calculateTA6Completion(): percentage of answerable questions (the
// TA6ResponseValue / TA6AnswerValue slots) with answer !== 'not-answered'.
// Document slots and free-text fields deliberately do NOT count.

import type {
  TA6AnswerValue,
  TA6DocumentValue,
  TA6MeteredConnection,
  TA6PropertyInformation,
  TA6ResponseValue,
  TA6Section1PropertyAndSeller,
  TA6Section5Alterations,
  TA6Section6Guarantees,
  TA6Section8Environmental,
  TA6Section9Rights,
  TA6Section11Services,
  TA6Section12Connections,
  TA6Section13Transaction,
  TA6ServiceConnection,
  TA6ServicedPlantConnection,
  TA6WarrantyItem,
  TA6WaterConnection,
} from './ta6.types';

// Mirrors the canister constant (transaction_manager main.mo). The canister
// stamps this on write (ADR 0007); the client sends it for transparency only.
export const TA6_FORM_VERSION = 'v6_2025_09_01';

export function emptyResponse(): TA6ResponseValue {
  return { answer: 'not-answered', details: '' };
}

export function emptyDocument(): TA6DocumentValue {
  return { status: 'not-answered', documentId: null };
}

function emptyWarranty(): TA6WarrantyItem {
  return { present: 'not-answered', document: emptyDocument() };
}

function emptyMetered(): TA6MeteredConnection {
  return { connected: 'not-answered', provider: null, meterLocation: null, supplyNumber: null };
}

function emptyService(): TA6ServiceConnection {
  return { connected: 'not-answered', provider: null };
}

function emptyWater(): TA6WaterConnection {
  return { connected: 'not-answered', provider: null, stopcockLocation: null, meterLocation: null };
}

function emptyPlant(): TA6ServicedPlantConnection {
  return { connected: 'not-answered', provider: null, makeModel: null, serviceProvider: null };
}

function emptySection1(): TA6Section1PropertyAndSeller {
  return {
    propertyAddress: '', postcode: '', uprn: null, sellers: [], sellerCompany: null,
    solicitor: { firmName: '', address: '', postcode: '', contactName: '', email: null, phone: null },
  };
}

function emptySection5(): TA6Section5Alterations {
  return {
    q5_1Alterations: {
      windowsPost2002: false, conservatory: false, extension: false, loftConversion: false,
      garageConversion: false, internalWallsRemoved: false, changeOfUse: false,
      structuralRoofWorks: false, other: false, otherDetails: null,
    },
    q5_2Documents: [], q5_3NonResidentialUse: emptyResponse(), q5_4Breaches: emptyResponse(),
    q5_5UnresolvedIssues: emptyResponse(), q5_6Solar: null, q5_7ListedBuilding: emptyResponse(),
    q5_8ConservationArea: emptyResponse(), q5_9TreePreservationOrder: emptyResponse(),
  };
}

function emptySection6(): TA6Section6Guarantees {
  return {
    q6_1NewHomeWarranty: emptyWarranty(), q6_1DampProofing: emptyWarranty(),
    q6_1TimberTreatment: emptyWarranty(), q6_1Roofing: emptyWarranty(),
    q6_1ElectricalWork: emptyWarranty(), q6_1WindowsDoors: emptyWarranty(),
    q6_1CentralHeating: emptyWarranty(), q6_1Underpinning: emptyWarranty(),
    q6_1Other: emptyWarranty(), q6_1OtherDetails: null,
    q6_2Claims: emptyResponse(), q6_3Breaches: emptyResponse(),
  };
}

function emptySection8(): TA6Section8Environmental {
  return {
    q8_1Flooded: emptyResponse(), q8_2FloodDefences: emptyResponse(),
    q8_3RadonTest: emptyResponse(), q8_3aReport: emptyDocument(),
    q8_3bBelowActionLevel: 'not-answered', q8_4RadonRemedialMeasures: emptyResponse(),
    q8_5GreenDeal: emptyResponse(), q8_5CurrentBill: emptyDocument(),
    q8_6JapaneseKnotweed: emptyResponse(), q8_7KnotweedSurvey: 'not-answered',
    q8_7SurveyDocument: emptyDocument(),
  };
}

function emptySection9(): TA6Section9Rights {
  return {
    q9_1RightsExercised: emptyResponse(), q9_1Rights: [], q9_2Contributions: emptyResponse(),
    q9_2Amount: null, q9_3Disagreements: emptyResponse(), q9_4OthersRights: emptyResponse(),
    q9_4Rights: [], q9_5ContributionsReceived: emptyResponse(), q9_5Amount: null,
    q9_6Disagreements: emptyResponse(), q9_7CrossingOtherProperty: emptyResponse(),
    q9_8LeadingToOthers: emptyResponse(), q9_9Arrangement: null,
  };
}

function emptySection11(): TA6Section11Services {
  return {
    q11_1ElectricalWorks: emptyResponse(), q11_2ElectricalCertificates: 'not-answered',
    q11_2Document: emptyDocument(), q11_3Eicr: 'not-answered', q11_3Report: emptyDocument(),
    q11_3Date: null, q11_4HeatingSystems: [], q11_5aFoulWaterMains: 'not-answered',
    q11_5bSurfaceWaterMains: 'not-answered', q11_6SewerageSource: null, q11_7SewerageSystem: null,
  };
}

function emptySection12(): TA6Section12Connections {
  return {
    mainsElectricity: emptyMetered(), mainsGas: emptyMetered(), mainsWater: emptyWater(),
    mainsSewerage: emptyService(), smallSewageTreatmentPlant: emptyPlant(),
    sharedHeatPumps: emptyPlant(), telephone: emptyService(), broadband: emptyService(),
    otherServices: null,
  };
}

function emptySection13(): TA6Section13Transaction {
  return {
    q13_1DependentPurchase: emptyResponse(), q13_2MovingDateRequirements: emptyResponse(),
    q13_3SellerLivesAtProperty: 'not-answered', q13_4OtherOccupiers17Plus: emptyResponse(),
    q13_4bTenantsOrLodgers: 'not-answered', q13_5VacantPossession: 'not-answered',
    q13_6OccupiersAgreedSignVacate: 'not-answered', q13_7Occupiers: [],
  };
}

export function emptyTA6Form(): TA6PropertyInformation {
  return {
    formVersion: TA6_FORM_VERSION,
    // Postcode-derived at form creation; England is the pre-derivation default.
    jurisdiction: 'england',
    section1: emptySection1(),
    section2: { q2_1Features: [], q2_2IrregularDescription: null, q2_3MovedOrAltered: emptyResponse() },
    section3: { q3_1ExistingDisputes: emptyResponse(), q3_2PotentialDisputes: emptyResponse() },
    section4: {
      q4_1NoticesReceived: emptyResponse(), q4_2NearbyDevelopment: emptyResponse(),
      q4_3NearbyUseChange: emptyResponse(),
    },
    section5: emptySection5(),
    section6: emptySection6(),
    section7: {
      q7_1DoYouInsure: 'not-answered', q7_1WhoInsuresIfNot: null,
      q7_2DifficultOrSpecialConditions: emptyResponse(), q7_3Claims: emptyResponse(),
    },
    section8: emptySection8(),
    section9: emptySection9(),
    section10: {
      q10_1Arrangements: [], q10_1Details: null, q10_2PermitRequired: emptyResponse(),
      q10_3EvChargingPoint: emptyResponse(), q10_3InstallConsent: emptyDocument(),
    },
    section11: emptySection11(),
    section12: emptySection12(),
    section13: emptySection13(),
    section14: {
      q14_1ProceedsClearCharges: emptyResponse(),
      q14_2Commitments: {
        vacantPossession: 'not-answered', removeSellersItems: 'not-answered',
        leaveServiceInfo: 'not-answered',
      },
    },
    section15: {
      q15_1ConsentsAttached: [], consentsAttachedList: null, consentsToFollowList: null,
      consentsNotAvailableList: null, additionalNotes: null,
    },
    completedBy: '',
    completedAt: null,
    lastModifiedBy: '',
    lastModifiedAt: new Date().toISOString(),
  };
}

// Fixed, always-present TA6ResponseValue slots (their .answer feeds the metric).
function fixedResponses(f: TA6PropertyInformation): TA6ResponseValue[] {
  const { section2: s2, section3: s3, section4: s4, section5: s5, section6: s6 } = f;
  const { section7: s7, section8: s8, section9: s9, section10: s10 } = f;
  const { section11: s11, section13: s13, section14: s14 } = f;
  return [
    s2.q2_3MovedOrAltered,
    s3.q3_1ExistingDisputes, s3.q3_2PotentialDisputes,
    s4.q4_1NoticesReceived, s4.q4_2NearbyDevelopment, s4.q4_3NearbyUseChange,
    s5.q5_3NonResidentialUse, s5.q5_4Breaches, s5.q5_5UnresolvedIssues,
    s5.q5_7ListedBuilding, s5.q5_8ConservationArea, s5.q5_9TreePreservationOrder,
    s6.q6_2Claims, s6.q6_3Breaches,
    s7.q7_2DifficultOrSpecialConditions, s7.q7_3Claims,
    s8.q8_1Flooded, s8.q8_2FloodDefences, s8.q8_3RadonTest, s8.q8_4RadonRemedialMeasures,
    s8.q8_5GreenDeal, s8.q8_6JapaneseKnotweed,
    s9.q9_1RightsExercised, s9.q9_2Contributions, s9.q9_3Disagreements, s9.q9_4OthersRights,
    s9.q9_5ContributionsReceived, s9.q9_6Disagreements, s9.q9_7CrossingOtherProperty,
    s9.q9_8LeadingToOthers,
    s10.q10_2PermitRequired, s10.q10_3EvChargingPoint,
    s11.q11_1ElectricalWorks,
    s13.q13_1DependentPurchase, s13.q13_2MovingDateRequirements, s13.q13_4OtherOccupiers17Plus,
    s14.q14_1ProceedsClearCharges,
  ];
}

// Fixed, always-present standalone TA6AnswerValue slots.
function fixedAnswers(f: TA6PropertyInformation): TA6AnswerValue[] {
  const { section6: s6, section7: s7, section8: s8, section11: s11 } = f;
  const { section12: s12, section13: s13, section14: s14 } = f;
  const warranties = [
    s6.q6_1NewHomeWarranty, s6.q6_1DampProofing, s6.q6_1TimberTreatment, s6.q6_1Roofing,
    s6.q6_1ElectricalWork, s6.q6_1WindowsDoors, s6.q6_1CentralHeating, s6.q6_1Underpinning,
    s6.q6_1Other,
  ].map((w) => w.present);
  const connections = [
    s12.mainsElectricity, s12.mainsGas, s12.mainsWater, s12.mainsSewerage,
    s12.smallSewageTreatmentPlant, s12.sharedHeatPumps, s12.telephone, s12.broadband,
  ].map((c) => c.connected);
  return [
    ...warranties, ...connections,
    s7.q7_1DoYouInsure,
    s8.q8_3bBelowActionLevel, s8.q8_7KnotweedSurvey,
    s11.q11_2ElectricalCertificates, s11.q11_3Eicr,
    s11.q11_5aFoulWaterMains, s11.q11_5bSurfaceWaterMains,
    s13.q13_3SellerLivesAtProperty, s13.q13_4bTenantsOrLodgers,
    s13.q13_5VacantPossession, s13.q13_6OccupiersAgreedSignVacate,
    s14.q14_2Commitments.vacantPossession, s14.q14_2Commitments.removeSellersItems,
    s14.q14_2Commitments.leaveServiceInfo,
  ];
}

// Conditional slots, counted only when their parent record exists.
function conditionalAnswers(f: TA6PropertyInformation): TA6AnswerValue[] {
  const sewerage = f.section11.q11_7SewerageSystem;
  return sewerage === null ? [] : [sewerage.infiltrationSystem, sewerage.regulationCompliant];
}

export function calculateTA6Completion(form: TA6PropertyInformation): number {
  const slots = [
    ...fixedResponses(form).map((r) => r.answer),
    ...fixedAnswers(form),
    ...conditionalAnswers(form),
  ];
  const answered = slots.filter((a) => a !== 'not-answered').length;
  // slots is never empty: the fixed question set alone contributes 68 entries.
  return Math.round((answered / slots.length) * 100);
}
