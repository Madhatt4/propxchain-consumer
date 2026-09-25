// TA6 6th edition, UI -> candid: section mappers 1-8. Sections 9-15 and the
// master record live in ta6ToCandid.ts (300-line file cap). Leaf conversions
// come from ta6CandidPrimitives.ts; variant tables from ta6CandidVariants.ts.

import {
  toCandidAnswer,
  toCandidDocument,
  toCandidOpt,
  toCandidOptMap,
  toCandidResponse,
  toCandidWarranty,
} from './ta6CandidPrimitives';
import { BOUNDARY_OWNERSHIP_TO_CANDID, SELLER_ROLE_TO_CANDID } from './ta6CandidVariants';

import type * as UI from '../../types/ta6.types';
import type * as C from './ta6Candid.types';

export function toCandidSection1(
  s: UI.TA6Section1PropertyAndSeller
): C.CandidSection1PropertyAndSeller {
  return {
    propertyAddress: s.propertyAddress,
    postcode: s.postcode,
    uprn: toCandidOpt(s.uprn),
    sellers: s.sellers.map((p) => ({
      fullName: p.fullName,
      role: SELLER_ROLE_TO_CANDID[p.role],
      ownershipOrAuthorityDate: toCandidOpt(p.ownershipOrAuthorityDate),
    })),
    sellerCompany: toCandidOptMap(s.sellerCompany, (co) => ({
      companyName: co.companyName,
      companyNumber: co.companyNumber,
      director: co.director,
      countryOfIncorporation: co.countryOfIncorporation,
    })),
    solicitor: {
      firmName: s.solicitor.firmName,
      address: s.solicitor.address,
      postcode: s.solicitor.postcode,
      contactName: s.solicitor.contactName,
      email: toCandidOpt(s.solicitor.email),
      phone: toCandidOpt(s.solicitor.phone),
    },
  };
}

export function toCandidSection2(s: UI.TA6Section2Boundaries): C.CandidSection2Boundaries {
  return {
    q2_1Features: s.q2_1Features.map((f) => ({
      position: f.position,
      ownership: BOUNDARY_OWNERSHIP_TO_CANDID[f.ownership],
    })),
    q2_2IrregularDescription: toCandidOpt(s.q2_2IrregularDescription),
    q2_3MovedOrAltered: toCandidResponse(s.q2_3MovedOrAltered),
  };
}

export function toCandidSection3(s: UI.TA6Section3Disputes): C.CandidSection3Disputes {
  return {
    q3_1ExistingDisputes: toCandidResponse(s.q3_1ExistingDisputes),
    q3_2PotentialDisputes: toCandidResponse(s.q3_2PotentialDisputes),
  };
}

export function toCandidSection4(s: UI.TA6Section4Notices): C.CandidSection4Notices {
  return {
    q4_1NoticesReceived: toCandidResponse(s.q4_1NoticesReceived),
    q4_2NearbyDevelopment: toCandidResponse(s.q4_2NearbyDevelopment),
    q4_3NearbyUseChange: toCandidResponse(s.q4_3NearbyUseChange),
  };
}

function toCandidSolar(v: UI.TA6SolarPower): C.CandidSolarPower {
  return {
    fitOrSegAgreement: toCandidDocument(v.fitOrSegAgreement),
    supplyAgreement: toCandidDocument(v.supplyAgreement),
    electricityBill: toCandidDocument(v.electricityBill),
    installDate: toCandidOpt(v.installDate),
    ownedOutright: toCandidOpt(v.ownedOutright),
    mcsCertificate: toCandidDocument(v.mcsCertificate),
  };
}

export function toCandidSection5(s: UI.TA6Section5Alterations): C.CandidSection5Alterations {
  const a = s.q5_1Alterations;
  return {
    q5_1Alterations: {
      windowsPost2002: a.windowsPost2002,
      conservatory: a.conservatory,
      extension: a.extension,
      loftConversion: a.loftConversion,
      garageConversion: a.garageConversion,
      internalWallsRemoved: a.internalWallsRemoved,
      changeOfUse: a.changeOfUse,
      structuralRoofWorks: a.structuralRoofWorks,
      other: a.other,
      otherDetails: toCandidOpt(a.otherDetails),
    },
    q5_2Documents: s.q5_2Documents.map(toCandidDocument),
    q5_3NonResidentialUse: toCandidResponse(s.q5_3NonResidentialUse),
    q5_4Breaches: toCandidResponse(s.q5_4Breaches),
    q5_5UnresolvedIssues: toCandidResponse(s.q5_5UnresolvedIssues),
    q5_6Solar: toCandidOptMap(s.q5_6Solar, toCandidSolar),
    q5_7ListedBuilding: toCandidResponse(s.q5_7ListedBuilding),
    q5_8ConservationArea: toCandidResponse(s.q5_8ConservationArea),
    q5_9TreePreservationOrder: toCandidResponse(s.q5_9TreePreservationOrder),
  };
}

export function toCandidSection6(s: UI.TA6Section6Guarantees): C.CandidSection6Guarantees {
  return {
    q6_1NewHomeWarranty: toCandidWarranty(s.q6_1NewHomeWarranty),
    q6_1DampProofing: toCandidWarranty(s.q6_1DampProofing),
    q6_1TimberTreatment: toCandidWarranty(s.q6_1TimberTreatment),
    q6_1Roofing: toCandidWarranty(s.q6_1Roofing),
    q6_1ElectricalWork: toCandidWarranty(s.q6_1ElectricalWork),
    q6_1WindowsDoors: toCandidWarranty(s.q6_1WindowsDoors),
    q6_1CentralHeating: toCandidWarranty(s.q6_1CentralHeating),
    q6_1Underpinning: toCandidWarranty(s.q6_1Underpinning),
    q6_1Other: toCandidWarranty(s.q6_1Other),
    q6_1OtherDetails: toCandidOpt(s.q6_1OtherDetails),
    q6_2Claims: toCandidResponse(s.q6_2Claims),
    q6_3Breaches: toCandidResponse(s.q6_3Breaches),
  };
}

export function toCandidSection7(s: UI.TA6Section7Insurance): C.CandidSection7Insurance {
  return {
    q7_1DoYouInsure: toCandidAnswer(s.q7_1DoYouInsure),
    q7_1WhoInsuresIfNot: toCandidOpt(s.q7_1WhoInsuresIfNot),
    q7_2DifficultOrSpecialConditions: toCandidResponse(s.q7_2DifficultOrSpecialConditions),
    q7_3Claims: toCandidResponse(s.q7_3Claims),
  };
}

export function toCandidSection8(s: UI.TA6Section8Environmental): C.CandidSection8Environmental {
  return {
    q8_1Flooded: toCandidResponse(s.q8_1Flooded),
    q8_2FloodDefences: toCandidResponse(s.q8_2FloodDefences),
    q8_3RadonTest: toCandidResponse(s.q8_3RadonTest),
    q8_3aReport: toCandidDocument(s.q8_3aReport),
    q8_3bBelowActionLevel: toCandidAnswer(s.q8_3bBelowActionLevel),
    q8_4RadonRemedialMeasures: toCandidResponse(s.q8_4RadonRemedialMeasures),
    q8_5GreenDeal: toCandidResponse(s.q8_5GreenDeal),
    q8_5CurrentBill: toCandidDocument(s.q8_5CurrentBill),
    q8_6JapaneseKnotweed: toCandidResponse(s.q8_6JapaneseKnotweed),
    q8_7KnotweedSurvey: toCandidAnswer(s.q8_7KnotweedSurvey),
    q8_7SurveyDocument: toCandidDocument(s.q8_7SurveyDocument),
  };
}
