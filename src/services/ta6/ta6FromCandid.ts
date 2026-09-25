// TA6 6th edition: candid record -> UI model (transaction_manager.getTA6),
// plus the cross-reference anomaly mapper. Section mappers 1-8 live in
// ta6FromCandidSections.ts (300-line file cap). Inverse conventions of
// ta6ToCandid.ts: [] -> null, bigint pence -> number, bigint ns -> ISO,
// Attached bigint -> documentId string, Principal -> principal text.

import {
  fromCandidAnswer,
  fromCandidDocument,
  fromCandidOpt,
  fromCandidOptMap,
  fromCandidPence,
  fromCandidResponse,
  fromCandidRight,
  nsToIso,
} from './ta6CandidPrimitives';
import {
  DISCHARGE_FROM_TAG,
  HEATING_FROM_TAG,
  JURISDICTION_FROM_TAG,
  PARKING_FROM_TAG,
  SEVERITY_FROM_TAG,
  SEWERAGE_FROM_TAG,
  candidVariantTag,
} from './ta6CandidVariants';
import { fromCandidSection1, fromCandidSection2, fromCandidSection3, fromCandidSection4, fromCandidSection5, fromCandidSection6, fromCandidSection7, fromCandidSection8 } from './ta6FromCandidSections';

import type * as UI from '../../types/ta6.types';
import type * as C from './ta6Candid.types';

// UI-side shape of a cross-reference anomaly (candid Anomaly, UI-friendly).
export type TA6AnomalySeverity = 'info' | 'warning' | 'conflict';

export interface TA6Anomaly {
  ref: string;
  severity: TA6AnomalySeverity;
  sources: string[];
  explanation: string;
  detectedAt: string; // ISO timestamp
}

export function fromCandidAnomaly(a: C.CandidAnomaly): TA6Anomaly {
  return {
    ref: a.ref,
    severity: SEVERITY_FROM_TAG[candidVariantTag(a.severity)],
    sources: [...a.sources],
    explanation: a.explanation,
    detectedAt: nsToIso(a.detectedAt),
  };
}

function fromCandidSection9(s: C.CandidSection9Rights): UI.TA6Section9Rights {
  return {
    q9_1RightsExercised: fromCandidResponse(s.q9_1RightsExercised),
    q9_1Rights: s.q9_1Rights.map(fromCandidRight),
    q9_2Contributions: fromCandidResponse(s.q9_2Contributions),
    q9_2Amount: fromCandidPence(s.q9_2Amount),
    q9_3Disagreements: fromCandidResponse(s.q9_3Disagreements),
    q9_4OthersRights: fromCandidResponse(s.q9_4OthersRights),
    q9_4Rights: s.q9_4Rights.map(fromCandidRight),
    q9_5ContributionsReceived: fromCandidResponse(s.q9_5ContributionsReceived),
    q9_5Amount: fromCandidPence(s.q9_5Amount),
    q9_6Disagreements: fromCandidResponse(s.q9_6Disagreements),
    q9_7CrossingOtherProperty: fromCandidResponse(s.q9_7CrossingOtherProperty),
    q9_8LeadingToOthers: fromCandidResponse(s.q9_8LeadingToOthers),
    q9_9Arrangement: fromCandidOptMap(s.q9_9Arrangement, (arr) => ({
      description: arr.description,
      contributionAmount: fromCandidPence(arr.contributionAmount),
      document: fromCandidDocument(arr.document),
    })),
  };
}

function fromCandidSection10(s: C.CandidSection10Parking): UI.TA6Section10Parking {
  return {
    q10_1Arrangements: s.q10_1Arrangements.map((p) => PARKING_FROM_TAG[candidVariantTag(p)]),
    q10_1Details: fromCandidOpt(s.q10_1Details),
    q10_2PermitRequired: fromCandidResponse(s.q10_2PermitRequired),
    q10_3EvChargingPoint: fromCandidResponse(s.q10_3EvChargingPoint),
    q10_3InstallConsent: fromCandidDocument(s.q10_3InstallConsent),
  };
}

function fromCandidSection11(s: C.CandidSection11Services): UI.TA6Section11Services {
  return {
    q11_1ElectricalWorks: fromCandidResponse(s.q11_1ElectricalWorks),
    q11_2ElectricalCertificates: fromCandidAnswer(s.q11_2ElectricalCertificates),
    q11_2Document: fromCandidDocument(s.q11_2Document),
    q11_3Eicr: fromCandidAnswer(s.q11_3Eicr),
    q11_3Report: fromCandidDocument(s.q11_3Report),
    q11_3Date: fromCandidOpt(s.q11_3Date),
    q11_4HeatingSystems: s.q11_4HeatingSystems.map((h) => ({
      heatingType: HEATING_FROM_TAG[candidVariantTag(h.heatingType)],
      otherDetails: fromCandidOpt(h.otherDetails),
      installDate: fromCandidOpt(h.installDate),
      lastServiceDate: fromCandidOpt(h.lastServiceDate),
      certificate: fromCandidDocument(h.certificate),
    })),
    q11_5aFoulWaterMains: fromCandidAnswer(s.q11_5aFoulWaterMains),
    q11_5bSurfaceWaterMains: fromCandidAnswer(s.q11_5bSurfaceWaterMains),
    q11_6SewerageSource: fromCandidOptMap(
      s.q11_6SewerageSource,
      (src) => SEWERAGE_FROM_TAG[candidVariantTag(src)]
    ),
    q11_7SewerageSystem: fromCandidOptMap(s.q11_7SewerageSystem, (sys) => ({
      source: SEWERAGE_FROM_TAG[candidVariantTag(sys.source)],
      otherDetails: fromCandidOpt(sys.otherDetails),
      location: fromCandidOpt(sys.location),
      lastServiceDate: fromCandidOpt(sys.lastServiceDate),
      dischargeType: fromCandidOptMap(
        sys.dischargeType,
        (d) => DISCHARGE_FROM_TAG[candidVariantTag(d)]
      ),
      infiltrationSystem: fromCandidAnswer(sys.infiltrationSystem),
      regulationCompliant: fromCandidAnswer(sys.regulationCompliant),
    })),
  };
}

function fromCandidSection12(s: C.CandidSection12Connections): UI.TA6Section12Connections {
  const metered = (m: C.CandidMeteredConnection): UI.TA6MeteredConnection => ({
    connected: fromCandidAnswer(m.connected),
    provider: fromCandidOpt(m.provider),
    meterLocation: fromCandidOpt(m.meterLocation),
    supplyNumber: fromCandidOpt(m.supplyNumber),
  });
  const service = (v: C.CandidServiceConnection): UI.TA6ServiceConnection => ({
    connected: fromCandidAnswer(v.connected),
    provider: fromCandidOpt(v.provider),
  });
  const plant = (p: C.CandidServicedPlantConnection): UI.TA6ServicedPlantConnection => ({
    connected: fromCandidAnswer(p.connected),
    provider: fromCandidOpt(p.provider),
    makeModel: fromCandidOpt(p.makeModel),
    serviceProvider: fromCandidOpt(p.serviceProvider),
  });
  return {
    mainsElectricity: metered(s.mainsElectricity),
    mainsGas: metered(s.mainsGas),
    mainsWater: {
      connected: fromCandidAnswer(s.mainsWater.connected),
      provider: fromCandidOpt(s.mainsWater.provider),
      stopcockLocation: fromCandidOpt(s.mainsWater.stopcockLocation),
      meterLocation: fromCandidOpt(s.mainsWater.meterLocation),
    },
    mainsSewerage: service(s.mainsSewerage),
    smallSewageTreatmentPlant: plant(s.smallSewageTreatmentPlant),
    sharedHeatPumps: plant(s.sharedHeatPumps),
    telephone: service(s.telephone),
    broadband: service(s.broadband),
    otherServices: fromCandidOpt(s.otherServices),
  };
}

function fromCandidSection13(s: C.CandidSection13Transaction): UI.TA6Section13Transaction {
  return {
    q13_1DependentPurchase: fromCandidResponse(s.q13_1DependentPurchase),
    q13_2MovingDateRequirements: fromCandidResponse(s.q13_2MovingDateRequirements),
    q13_3SellerLivesAtProperty: fromCandidAnswer(s.q13_3SellerLivesAtProperty),
    q13_4OtherOccupiers17Plus: fromCandidResponse(s.q13_4OtherOccupiers17Plus),
    q13_4bTenantsOrLodgers: fromCandidAnswer(s.q13_4bTenantsOrLodgers),
    q13_5VacantPossession: fromCandidAnswer(s.q13_5VacantPossession),
    q13_6OccupiersAgreedSignVacate: fromCandidAnswer(s.q13_6OccupiersAgreedSignVacate),
    q13_7Occupiers: s.q13_7Occupiers.map((o) => ({
      fullName: o.fullName,
      age: fromCandidOptMap(o.age, Number),
      tenancyAgreement: fromCandidDocument(o.tenancyAgreement),
    })),
  };
}

function fromCandidSection14(s: C.CandidSection14Completion): UI.TA6Section14Completion {
  return {
    q14_1ProceedsClearCharges: fromCandidResponse(s.q14_1ProceedsClearCharges),
    q14_2Commitments: {
      vacantPossession: fromCandidAnswer(s.q14_2Commitments.vacantPossession),
      removeSellersItems: fromCandidAnswer(s.q14_2Commitments.removeSellersItems),
      leaveServiceInfo: fromCandidAnswer(s.q14_2Commitments.leaveServiceInfo),
    },
  };
}

function fromCandidSection15(s: C.CandidSection15AdditionalInfo): UI.TA6Section15AdditionalInfo {
  return {
    q15_1ConsentsAttached: s.q15_1ConsentsAttached.map(fromCandidDocument),
    consentsAttachedList: fromCandidOpt(s.consentsAttachedList),
    consentsToFollowList: fromCandidOpt(s.consentsToFollowList),
    consentsNotAvailableList: fromCandidOpt(s.consentsNotAvailableList),
    additionalNotes: fromCandidOpt(s.additionalNotes),
  };
}

// ---------- Master ----------

export function fromCandidTA6(c: C.CandidTA6PropertyInformation): UI.TA6PropertyInformation {
  return {
    formVersion: c.formVersion,
    jurisdiction: JURISDICTION_FROM_TAG[candidVariantTag(c.jurisdiction)],
    section1: fromCandidSection1(c.section1),
    section2: fromCandidSection2(c.section2),
    section3: fromCandidSection3(c.section3),
    section4: fromCandidSection4(c.section4),
    section5: fromCandidSection5(c.section5),
    section6: fromCandidSection6(c.section6),
    section7: fromCandidSection7(c.section7),
    section8: fromCandidSection8(c.section8),
    section9: fromCandidSection9(c.section9),
    section10: fromCandidSection10(c.section10),
    section11: fromCandidSection11(c.section11),
    section12: fromCandidSection12(c.section12),
    section13: fromCandidSection13(c.section13),
    section14: fromCandidSection14(c.section14),
    section15: fromCandidSection15(c.section15),
    completedBy: c.completedBy.toText(),
    completedAt: fromCandidOptMap(c.completedAt, nsToIso),
    lastModifiedBy: c.lastModifiedBy.toText(),
    lastModifiedAt: nsToIso(c.lastModifiedAt),
  };
}
