// TA6 6th edition: UI model -> candid record (transaction_manager.updateTA6).
// Section mappers 1-8 live in ta6ToCandidSections.ts (300-line file cap);
// this file holds sections 9-15 and the master toCandidTA6. The candid shape
// mirrors transaction_manager.did.d.ts by construction (ta6Candid.types.ts).
// completedBy/lastModifiedBy are sent as the anonymous principal — the
// canister stamps the authenticated caller and Time.now on write.

import { Principal } from '@propxchain/core-client';

import {
  isoToNs,
  toCandidAnswer,
  toCandidDocument,
  toCandidOpt,
  toCandidOptMap,
  toCandidPence,
  toCandidResponse,
  toCandidRight,
} from './ta6CandidPrimitives';
import {
  DISCHARGE_TO_CANDID,
  HEATING_TO_CANDID,
  JURISDICTION_TO_CANDID,
  PARKING_TO_CANDID,
  SEWERAGE_TO_CANDID,
} from './ta6CandidVariants';
import {
  toCandidSection1,
  toCandidSection2,
  toCandidSection3,
  toCandidSection4,
  toCandidSection5,
  toCandidSection6,
  toCandidSection7,
  toCandidSection8,
} from './ta6ToCandidSections';

import type * as UI from '../../types/ta6.types';
import type * as C from './ta6Candid.types';

function toCandidSection9(s: UI.TA6Section9Rights): C.CandidSection9Rights {
  return {
    q9_1RightsExercised: toCandidResponse(s.q9_1RightsExercised),
    q9_1Rights: s.q9_1Rights.map(toCandidRight),
    q9_2Contributions: toCandidResponse(s.q9_2Contributions),
    q9_2Amount: toCandidPence(s.q9_2Amount),
    q9_3Disagreements: toCandidResponse(s.q9_3Disagreements),
    q9_4OthersRights: toCandidResponse(s.q9_4OthersRights),
    q9_4Rights: s.q9_4Rights.map(toCandidRight),
    q9_5ContributionsReceived: toCandidResponse(s.q9_5ContributionsReceived),
    q9_5Amount: toCandidPence(s.q9_5Amount),
    q9_6Disagreements: toCandidResponse(s.q9_6Disagreements),
    q9_7CrossingOtherProperty: toCandidResponse(s.q9_7CrossingOtherProperty),
    q9_8LeadingToOthers: toCandidResponse(s.q9_8LeadingToOthers),
    q9_9Arrangement: toCandidOptMap(s.q9_9Arrangement, (arr) => ({
      description: arr.description,
      contributionAmount: toCandidPence(arr.contributionAmount),
      document: toCandidDocument(arr.document),
    })),
  };
}

function toCandidSection10(s: UI.TA6Section10Parking): C.CandidSection10Parking {
  return {
    q10_1Arrangements: s.q10_1Arrangements.map((p) => PARKING_TO_CANDID[p]),
    q10_1Details: toCandidOpt(s.q10_1Details),
    q10_2PermitRequired: toCandidResponse(s.q10_2PermitRequired),
    q10_3EvChargingPoint: toCandidResponse(s.q10_3EvChargingPoint),
    q10_3InstallConsent: toCandidDocument(s.q10_3InstallConsent),
  };
}

function toCandidSection11(s: UI.TA6Section11Services): C.CandidSection11Services {
  return {
    q11_1ElectricalWorks: toCandidResponse(s.q11_1ElectricalWorks),
    q11_2ElectricalCertificates: toCandidAnswer(s.q11_2ElectricalCertificates),
    q11_2Document: toCandidDocument(s.q11_2Document),
    q11_3Eicr: toCandidAnswer(s.q11_3Eicr),
    q11_3Report: toCandidDocument(s.q11_3Report),
    q11_3Date: toCandidOpt(s.q11_3Date),
    q11_4HeatingSystems: s.q11_4HeatingSystems.map((h) => ({
      heatingType: HEATING_TO_CANDID[h.heatingType],
      otherDetails: toCandidOpt(h.otherDetails),
      installDate: toCandidOpt(h.installDate),
      lastServiceDate: toCandidOpt(h.lastServiceDate),
      certificate: toCandidDocument(h.certificate),
    })),
    q11_5aFoulWaterMains: toCandidAnswer(s.q11_5aFoulWaterMains),
    q11_5bSurfaceWaterMains: toCandidAnswer(s.q11_5bSurfaceWaterMains),
    q11_6SewerageSource: toCandidOptMap(s.q11_6SewerageSource, (src) => SEWERAGE_TO_CANDID[src]),
    q11_7SewerageSystem: toCandidOptMap(s.q11_7SewerageSystem, (sys) => ({
      source: SEWERAGE_TO_CANDID[sys.source],
      otherDetails: toCandidOpt(sys.otherDetails),
      location: toCandidOpt(sys.location),
      lastServiceDate: toCandidOpt(sys.lastServiceDate),
      dischargeType: toCandidOptMap(sys.dischargeType, (d) => DISCHARGE_TO_CANDID[d]),
      infiltrationSystem: toCandidAnswer(sys.infiltrationSystem),
      regulationCompliant: toCandidAnswer(sys.regulationCompliant),
    })),
  };
}

function toCandidSection12(s: UI.TA6Section12Connections): C.CandidSection12Connections {
  const metered = (m: UI.TA6MeteredConnection): C.CandidMeteredConnection => ({
    connected: toCandidAnswer(m.connected),
    provider: toCandidOpt(m.provider),
    meterLocation: toCandidOpt(m.meterLocation),
    supplyNumber: toCandidOpt(m.supplyNumber),
  });
  const service = (v: UI.TA6ServiceConnection): C.CandidServiceConnection => ({
    connected: toCandidAnswer(v.connected),
    provider: toCandidOpt(v.provider),
  });
  const plant = (p: UI.TA6ServicedPlantConnection): C.CandidServicedPlantConnection => ({
    connected: toCandidAnswer(p.connected),
    provider: toCandidOpt(p.provider),
    makeModel: toCandidOpt(p.makeModel),
    serviceProvider: toCandidOpt(p.serviceProvider),
  });
  return {
    mainsElectricity: metered(s.mainsElectricity),
    mainsGas: metered(s.mainsGas),
    mainsWater: {
      connected: toCandidAnswer(s.mainsWater.connected),
      provider: toCandidOpt(s.mainsWater.provider),
      stopcockLocation: toCandidOpt(s.mainsWater.stopcockLocation),
      meterLocation: toCandidOpt(s.mainsWater.meterLocation),
    },
    mainsSewerage: service(s.mainsSewerage),
    smallSewageTreatmentPlant: plant(s.smallSewageTreatmentPlant),
    sharedHeatPumps: plant(s.sharedHeatPumps),
    telephone: service(s.telephone),
    broadband: service(s.broadband),
    otherServices: toCandidOpt(s.otherServices),
  };
}

function toCandidSection13(s: UI.TA6Section13Transaction): C.CandidSection13Transaction {
  return {
    q13_1DependentPurchase: toCandidResponse(s.q13_1DependentPurchase),
    q13_2MovingDateRequirements: toCandidResponse(s.q13_2MovingDateRequirements),
    q13_3SellerLivesAtProperty: toCandidAnswer(s.q13_3SellerLivesAtProperty),
    q13_4OtherOccupiers17Plus: toCandidResponse(s.q13_4OtherOccupiers17Plus),
    q13_4bTenantsOrLodgers: toCandidAnswer(s.q13_4bTenantsOrLodgers),
    q13_5VacantPossession: toCandidAnswer(s.q13_5VacantPossession),
    q13_6OccupiersAgreedSignVacate: toCandidAnswer(s.q13_6OccupiersAgreedSignVacate),
    q13_7Occupiers: s.q13_7Occupiers.map((o) => ({
      fullName: o.fullName,
      age: toCandidOptMap(o.age, BigInt),
      tenancyAgreement: toCandidDocument(o.tenancyAgreement),
    })),
  };
}

function toCandidSection14(s: UI.TA6Section14Completion): C.CandidSection14Completion {
  return {
    q14_1ProceedsClearCharges: toCandidResponse(s.q14_1ProceedsClearCharges),
    q14_2Commitments: {
      vacantPossession: toCandidAnswer(s.q14_2Commitments.vacantPossession),
      removeSellersItems: toCandidAnswer(s.q14_2Commitments.removeSellersItems),
      leaveServiceInfo: toCandidAnswer(s.q14_2Commitments.leaveServiceInfo),
    },
  };
}

function toCandidSection15(s: UI.TA6Section15AdditionalInfo): C.CandidSection15AdditionalInfo {
  return {
    q15_1ConsentsAttached: s.q15_1ConsentsAttached.map(toCandidDocument),
    consentsAttachedList: toCandidOpt(s.consentsAttachedList),
    consentsToFollowList: toCandidOpt(s.consentsToFollowList),
    consentsNotAvailableList: toCandidOpt(s.consentsNotAvailableList),
    additionalNotes: toCandidOpt(s.additionalNotes),
  };
}

// ---------- Master ----------

export function toCandidTA6(data: UI.TA6PropertyInformation): C.CandidTA6PropertyInformation {
  return {
    formVersion: data.formVersion, // passthrough — canister overwrites (ADR 0007)
    jurisdiction: JURISDICTION_TO_CANDID[data.jurisdiction],
    section1: toCandidSection1(data.section1),
    section2: toCandidSection2(data.section2),
    section3: toCandidSection3(data.section3),
    section4: toCandidSection4(data.section4),
    section5: toCandidSection5(data.section5),
    section6: toCandidSection6(data.section6),
    section7: toCandidSection7(data.section7),
    section8: toCandidSection8(data.section8),
    section9: toCandidSection9(data.section9),
    section10: toCandidSection10(data.section10),
    section11: toCandidSection11(data.section11),
    section12: toCandidSection12(data.section12),
    section13: toCandidSection13(data.section13),
    section14: toCandidSection14(data.section14),
    section15: toCandidSection15(data.section15),
    // Canister stamps the authenticated caller + Time.now on write.
    completedBy: Principal.anonymous(),
    completedAt: toCandidOptMap(data.completedAt, isoToNs),
    lastModifiedBy: Principal.anonymous(),
    lastModifiedAt: isoToNs(data.lastModifiedAt),
  };
}
