// TA6 6th edition, candid -> UI: section mappers 1-8. Sections 9-15, the
// master record, and the anomaly mapper live in ta6FromCandid.ts (300-line
// file cap). Leaf conversions come from ta6CandidPrimitives.ts.

import {
  fromCandidAnswer,
  fromCandidDocument,
  fromCandidOpt,
  fromCandidOptMap,
  fromCandidResponse,
  fromCandidWarranty,
} from './ta6CandidPrimitives';
import {
  BOUNDARY_OWNERSHIP_FROM_TAG,
  SELLER_ROLE_FROM_TAG,
  candidVariantTag,
} from './ta6CandidVariants';

import type * as UI from '../../types/ta6.types';
import type * as C from './ta6Candid.types';

export function fromCandidSection1(
  s: C.CandidSection1PropertyAndSeller
): UI.TA6Section1PropertyAndSeller {
  return {
    propertyAddress: s.propertyAddress,
    postcode: s.postcode,
    uprn: fromCandidOpt(s.uprn),
    sellers: s.sellers.map((p) => ({
      fullName: p.fullName,
      role: SELLER_ROLE_FROM_TAG[candidVariantTag(p.role)],
      ownershipOrAuthorityDate: fromCandidOpt(p.ownershipOrAuthorityDate),
    })),
    sellerCompany: fromCandidOptMap(s.sellerCompany, (co) => ({
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
      email: fromCandidOpt(s.solicitor.email),
      phone: fromCandidOpt(s.solicitor.phone),
    },
  };
}

export function fromCandidSection2(s: C.CandidSection2Boundaries): UI.TA6Section2Boundaries {
  return {
    q2_1Features: s.q2_1Features.map((f) => ({
      position: f.position,
      ownership: BOUNDARY_OWNERSHIP_FROM_TAG[candidVariantTag(f.ownership)],
    })),
    q2_2IrregularDescription: fromCandidOpt(s.q2_2IrregularDescription),
    q2_3MovedOrAltered: fromCandidResponse(s.q2_3MovedOrAltered),
  };
}

export function fromCandidSection3(s: C.CandidSection3Disputes): UI.TA6Section3Disputes {
  return {
    q3_1ExistingDisputes: fromCandidResponse(s.q3_1ExistingDisputes),
    q3_2PotentialDisputes: fromCandidResponse(s.q3_2PotentialDisputes),
  };
}

export function fromCandidSection4(s: C.CandidSection4Notices): UI.TA6Section4Notices {
  return {
    q4_1NoticesReceived: fromCandidResponse(s.q4_1NoticesReceived),
    q4_2NearbyDevelopment: fromCandidResponse(s.q4_2NearbyDevelopment),
    q4_3NearbyUseChange: fromCandidResponse(s.q4_3NearbyUseChange),
  };
}

function fromCandidSolar(v: C.CandidSolarPower): UI.TA6SolarPower {
  return {
    fitOrSegAgreement: fromCandidDocument(v.fitOrSegAgreement),
    supplyAgreement: fromCandidDocument(v.supplyAgreement),
    electricityBill: fromCandidDocument(v.electricityBill),
    installDate: fromCandidOpt(v.installDate),
    ownedOutright: fromCandidOpt(v.ownedOutright),
    mcsCertificate: fromCandidDocument(v.mcsCertificate),
  };
}

export function fromCandidSection5(s: C.CandidSection5Alterations): UI.TA6Section5Alterations {
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
      otherDetails: fromCandidOpt(a.otherDetails),
    },
    q5_2Documents: s.q5_2Documents.map(fromCandidDocument),
    q5_3NonResidentialUse: fromCandidResponse(s.q5_3NonResidentialUse),
    q5_4Breaches: fromCandidResponse(s.q5_4Breaches),
    q5_5UnresolvedIssues: fromCandidResponse(s.q5_5UnresolvedIssues),
    q5_6Solar: fromCandidOptMap(s.q5_6Solar, fromCandidSolar),
    q5_7ListedBuilding: fromCandidResponse(s.q5_7ListedBuilding),
    q5_8ConservationArea: fromCandidResponse(s.q5_8ConservationArea),
    q5_9TreePreservationOrder: fromCandidResponse(s.q5_9TreePreservationOrder),
  };
}

export function fromCandidSection6(s: C.CandidSection6Guarantees): UI.TA6Section6Guarantees {
  return {
    q6_1NewHomeWarranty: fromCandidWarranty(s.q6_1NewHomeWarranty),
    q6_1DampProofing: fromCandidWarranty(s.q6_1DampProofing),
    q6_1TimberTreatment: fromCandidWarranty(s.q6_1TimberTreatment),
    q6_1Roofing: fromCandidWarranty(s.q6_1Roofing),
    q6_1ElectricalWork: fromCandidWarranty(s.q6_1ElectricalWork),
    q6_1WindowsDoors: fromCandidWarranty(s.q6_1WindowsDoors),
    q6_1CentralHeating: fromCandidWarranty(s.q6_1CentralHeating),
    q6_1Underpinning: fromCandidWarranty(s.q6_1Underpinning),
    q6_1Other: fromCandidWarranty(s.q6_1Other),
    q6_1OtherDetails: fromCandidOpt(s.q6_1OtherDetails),
    q6_2Claims: fromCandidResponse(s.q6_2Claims),
    q6_3Breaches: fromCandidResponse(s.q6_3Breaches),
  };
}

export function fromCandidSection7(s: C.CandidSection7Insurance): UI.TA6Section7Insurance {
  return {
    q7_1DoYouInsure: fromCandidAnswer(s.q7_1DoYouInsure),
    q7_1WhoInsuresIfNot: fromCandidOpt(s.q7_1WhoInsuresIfNot),
    q7_2DifficultOrSpecialConditions: fromCandidResponse(s.q7_2DifficultOrSpecialConditions),
    q7_3Claims: fromCandidResponse(s.q7_3Claims),
  };
}

export function fromCandidSection8(s: C.CandidSection8Environmental): UI.TA6Section8Environmental {
  return {
    q8_1Flooded: fromCandidResponse(s.q8_1Flooded),
    q8_2FloodDefences: fromCandidResponse(s.q8_2FloodDefences),
    q8_3RadonTest: fromCandidResponse(s.q8_3RadonTest),
    q8_3aReport: fromCandidDocument(s.q8_3aReport),
    q8_3bBelowActionLevel: fromCandidAnswer(s.q8_3bBelowActionLevel),
    q8_4RadonRemedialMeasures: fromCandidResponse(s.q8_4RadonRemedialMeasures),
    q8_5GreenDeal: fromCandidResponse(s.q8_5GreenDeal),
    q8_5CurrentBill: fromCandidDocument(s.q8_5CurrentBill),
    q8_6JapaneseKnotweed: fromCandidResponse(s.q8_6JapaneseKnotweed),
    q8_7KnotweedSurvey: fromCandidAnswer(s.q8_7KnotweedSurvey),
    q8_7SurveyDocument: fromCandidDocument(s.q8_7SurveyDocument),
  };
}
