// Stepper metadata for the TA6 6th-edition shell: the 15 section titles
// (mirroring the official form order), a per-section completion check, and the
// ref -> step mapping used to place cross-reference anomalies on their section.

import type { TA6AnswerValue, TA6PropertyInformation } from '../../../types/ta6.types';

// Section titles in form order (index 0 = §1). Sourced from the section
// interface names/comments in ta6.sections.ts.
export const TA6_SECTION_TITLES: readonly string[] = [
  'Property and seller details',
  'Boundaries',
  'Disputes and complaints',
  'Notices and proposals',
  'Alterations, planning and building control',
  'Guarantees and warranties',
  'Insurance',
  'Environmental matters',
  'Rights and informal arrangements',
  'Parking',
  'Services',
  'Connection to services',
  'Transaction information',
  'Completion and moving',
  'Additional information',
];

export const TA6_STEP_COUNT = TA6_SECTION_TITLES.length;

// Answer slots for §2–§8 (returns null when the step is out of this range).
function earlySectionSlots(form: TA6PropertyInformation, step: number): TA6AnswerValue[] | null {
  switch (step) {
    case 2:
      return [form.section2.q2_3MovedOrAltered.answer];
    case 3:
      return [form.section3.q3_1ExistingDisputes.answer, form.section3.q3_2PotentialDisputes.answer];
    case 4:
      return [
        form.section4.q4_1NoticesReceived.answer,
        form.section4.q4_2NearbyDevelopment.answer,
        form.section4.q4_3NearbyUseChange.answer,
      ];
    case 5: {
      const s = form.section5;
      return [
        s.q5_3NonResidentialUse.answer, s.q5_4Breaches.answer, s.q5_5UnresolvedIssues.answer,
        s.q5_7ListedBuilding.answer, s.q5_8ConservationArea.answer, s.q5_9TreePreservationOrder.answer,
      ];
    }
    case 6: {
      const s = form.section6;
      const warranties = [
        s.q6_1NewHomeWarranty, s.q6_1DampProofing, s.q6_1TimberTreatment, s.q6_1Roofing,
        s.q6_1ElectricalWork, s.q6_1WindowsDoors, s.q6_1CentralHeating, s.q6_1Underpinning, s.q6_1Other,
      ].map((w) => w.present);
      return [...warranties, s.q6_2Claims.answer, s.q6_3Breaches.answer];
    }
    case 7: {
      const s = form.section7;
      return [s.q7_1DoYouInsure, s.q7_2DifficultOrSpecialConditions.answer, s.q7_3Claims.answer];
    }
    case 8: {
      const s = form.section8;
      return [
        s.q8_1Flooded.answer, s.q8_2FloodDefences.answer, s.q8_3RadonTest.answer,
        s.q8_4RadonRemedialMeasures.answer, s.q8_5GreenDeal.answer, s.q8_6JapaneseKnotweed.answer,
        s.q8_3bBelowActionLevel, s.q8_7KnotweedSurvey,
      ];
    }
    default:
      return null;
  }
}

// Answer slots for §9–§14 (returns null when the step is out of this range).
function lateSectionSlots(form: TA6PropertyInformation, step: number): TA6AnswerValue[] | null {
  switch (step) {
    case 9: {
      const s = form.section9;
      return [
        s.q9_1RightsExercised.answer, s.q9_2Contributions.answer, s.q9_3Disagreements.answer,
        s.q9_4OthersRights.answer, s.q9_5ContributionsReceived.answer, s.q9_6Disagreements.answer,
        s.q9_7CrossingOtherProperty.answer, s.q9_8LeadingToOthers.answer,
      ];
    }
    case 10:
      return [form.section10.q10_2PermitRequired.answer, form.section10.q10_3EvChargingPoint.answer];
    case 11: {
      const s = form.section11;
      const base: TA6AnswerValue[] = [
        s.q11_1ElectricalWorks.answer, s.q11_2ElectricalCertificates, s.q11_3Eicr,
        s.q11_5aFoulWaterMains, s.q11_5bSurfaceWaterMains,
      ];
      const sys = s.q11_7SewerageSystem;
      return sys === null ? base : [...base, sys.infiltrationSystem, sys.regulationCompliant];
    }
    case 12: {
      const s = form.section12;
      return [
        s.mainsElectricity, s.mainsGas, s.mainsWater, s.mainsSewerage,
        s.smallSewageTreatmentPlant, s.sharedHeatPumps, s.telephone, s.broadband,
      ].map((c) => c.connected);
    }
    case 13: {
      const s = form.section13;
      return [
        s.q13_1DependentPurchase.answer, s.q13_2MovingDateRequirements.answer,
        s.q13_4OtherOccupiers17Plus.answer, s.q13_3SellerLivesAtProperty, s.q13_4bTenantsOrLodgers,
        s.q13_5VacantPossession, s.q13_6OccupiersAgreedSignVacate,
      ];
    }
    case 14: {
      const s = form.section14;
      return [
        s.q14_1ProceedsClearCharges.answer, s.q14_2Commitments.vacantPossession,
        s.q14_2Commitments.removeSellersItems, s.q14_2Commitments.leaveServiceInfo,
      ];
    }
    default:
      return null;
  }
}

// The answerable answer/response slots for one section (1-based step). Mirrors
// the grouping the completion metric uses (ta6.defaults.ts) but keyed by
// section so the stepper can show a per-section tick. §1 (facts only) and §15
// (optional free text) have no answer slots — handled in isSectionComplete.
function sectionAnswerSlots(form: TA6PropertyInformation, step: number): TA6AnswerValue[] {
  return earlySectionSlots(form, step) ?? lateSectionSlots(form, step) ?? [];
}

/**
 * A section is complete when every answerable slot in it has a non-draft
 * answer. §1 is factual (needs an address and at least one seller); §15 is
 * optional additional info (always considered complete).
 */
export function isSectionComplete(form: TA6PropertyInformation, step: number): boolean {
  if (step === 1) {
    return form.section1.propertyAddress.trim().length > 0 && form.section1.sellers.length > 0;
  }
  const slots = sectionAnswerSlots(form, step);
  if (slots.length === 0) return true;
  return slots.every((answer) => answer !== 'not-answered');
}

/** Map a question ref (e.g. "8.3a", "1.postcode") to its 1-based section step. */
export function stepForRef(ref: string): number | null {
  const lead = /^(\d{1,2})/.exec(ref);
  if (lead === null) return null;
  const step = Number(lead[1]);
  return step >= 1 && step <= TA6_STEP_COUNT ? step : null;
}

/**
 * Map a section NAME to its 1-based step. The form-check function names a
 * section either bare (`section5`) or with its slug (`section5_alterations`)
 * depending on whether the finding came from the deterministic rules or from
 * the model, so both spellings resolve here and no caller has to know which
 * it was handed.
 */
export function stepForSectionName(name: string): number | null {
  const match = /^section(\d{1,2})(?:_|$)/.exec(name);
  if (match === null) return null;
  const step = Number(match[1]);
  return step >= 1 && step <= TA6_STEP_COUNT ? step : null;
}
