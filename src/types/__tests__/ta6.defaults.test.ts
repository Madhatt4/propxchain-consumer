import { describe, expect, it } from 'vitest';

import { TA6_FORM_VERSION, calculateTA6Completion, emptyTA6Form } from '../ta6.types';
import type { TA6PropertyInformation, TA6ResponseValue } from '../ta6.types';

function yes(): TA6ResponseValue {
  return { answer: 'yes', details: 'fixture details' };
}

function answerSections2to5(f: TA6PropertyInformation): void {
  f.section2.q2_3MovedOrAltered = yes();
  f.section3.q3_1ExistingDisputes = yes();
  f.section3.q3_2PotentialDisputes = yes();
  f.section4.q4_1NoticesReceived = yes();
  f.section4.q4_2NearbyDevelopment = yes();
  f.section4.q4_3NearbyUseChange = yes();
  f.section5.q5_3NonResidentialUse = yes();
  f.section5.q5_4Breaches = yes();
  f.section5.q5_5UnresolvedIssues = yes();
  f.section5.q5_7ListedBuilding = yes();
  f.section5.q5_8ConservationArea = yes();
  f.section5.q5_9TreePreservationOrder = yes();
}

function answerSections6to9(f: TA6PropertyInformation): void {
  const s6 = f.section6;
  const warranties = [
    s6.q6_1NewHomeWarranty, s6.q6_1DampProofing, s6.q6_1TimberTreatment, s6.q6_1Roofing,
    s6.q6_1ElectricalWork, s6.q6_1WindowsDoors, s6.q6_1CentralHeating, s6.q6_1Underpinning,
    s6.q6_1Other,
  ];
  warranties.forEach((w) => {
    w.present = 'yes';
  });
  s6.q6_2Claims = yes();
  s6.q6_3Breaches = yes();
  f.section7.q7_1DoYouInsure = 'yes';
  f.section7.q7_2DifficultOrSpecialConditions = yes();
  f.section7.q7_3Claims = yes();
  f.section8.q8_1Flooded = yes();
  f.section8.q8_2FloodDefences = yes();
  f.section8.q8_3RadonTest = yes();
  f.section8.q8_3bBelowActionLevel = 'no';
  f.section8.q8_4RadonRemedialMeasures = yes();
  f.section8.q8_5GreenDeal = yes();
  f.section8.q8_6JapaneseKnotweed = yes();
  f.section8.q8_7KnotweedSurvey = 'not-known';
  f.section9.q9_1RightsExercised = yes();
  f.section9.q9_2Contributions = yes();
  f.section9.q9_3Disagreements = yes();
  f.section9.q9_4OthersRights = yes();
  f.section9.q9_5ContributionsReceived = yes();
  f.section9.q9_6Disagreements = yes();
  f.section9.q9_7CrossingOtherProperty = yes();
  f.section9.q9_8LeadingToOthers = yes();
}

function answerSections10to14(f: TA6PropertyInformation): void {
  f.section10.q10_2PermitRequired = yes();
  f.section10.q10_3EvChargingPoint = yes();
  f.section11.q11_1ElectricalWorks = yes();
  f.section11.q11_2ElectricalCertificates = 'yes';
  f.section11.q11_3Eicr = 'yes';
  f.section11.q11_5aFoulWaterMains = 'yes';
  f.section11.q11_5bSurfaceWaterMains = 'no';
  const s12 = f.section12;
  const connections = [
    s12.mainsElectricity, s12.mainsGas, s12.mainsWater, s12.mainsSewerage,
    s12.smallSewageTreatmentPlant, s12.sharedHeatPumps, s12.telephone, s12.broadband,
  ];
  connections.forEach((c) => {
    c.connected = 'yes';
  });
  f.section13.q13_1DependentPurchase = yes();
  f.section13.q13_2MovingDateRequirements = yes();
  f.section13.q13_3SellerLivesAtProperty = 'yes';
  f.section13.q13_4OtherOccupiers17Plus = yes();
  f.section13.q13_4bTenantsOrLodgers = 'no';
  f.section13.q13_5VacantPossession = 'yes';
  f.section13.q13_6OccupiersAgreedSignVacate = 'not-applicable';
  f.section14.q14_1ProceedsClearCharges = yes();
  f.section14.q14_2Commitments = {
    vacantPossession: 'yes', removeSellersItems: 'yes', leaveServiceInfo: 'yes',
  };
}

function fullyAnsweredTA6(): TA6PropertyInformation {
  const form = emptyTA6Form();
  answerSections2to5(form);
  answerSections6to9(form);
  answerSections10to14(form);
  return form;
}

describe('emptyTA6Form', () => {
  it('should report 0 completion when no question has been answered', () => {
    // Arrange + Act
    const percentage = calculateTA6Completion(emptyTA6Form());
    // Assert
    expect(percentage).toBe(0);
  });

  it('should stamp the canister form version constant on the draft', () => {
    expect(emptyTA6Form().formVersion).toBe(TA6_FORM_VERSION);
  });
});

describe('calculateTA6Completion', () => {
  it('should return 100 when every answerable question has an answer', () => {
    // Arrange
    const form = fullyAnsweredTA6();
    // Act + Assert
    expect(calculateTA6Completion(form)).toBe(100);
  });

  it('should return a value strictly between 0 and 100 for a partially answered form', () => {
    // Arrange
    const form = emptyTA6Form();
    answerSections2to5(form);
    // Act
    const percentage = calculateTA6Completion(form);
    // Assert
    expect(percentage).toBeGreaterThan(0);
    expect(percentage).toBeLessThan(100);
  });

  it('should count not-known and not-applicable as answered', () => {
    // Arrange
    const form = emptyTA6Form();
    form.section3.q3_1ExistingDisputes = { answer: 'not-known', details: '' };
    form.section7.q7_1DoYouInsure = 'not-applicable';
    // Act + Assert
    expect(calculateTA6Completion(form)).toBeGreaterThan(0);
  });

  it('should count conditional sewerage answers only when the record exists', () => {
    // Arrange: fully answered form gains an unanswered non-mains sewerage record
    const form = fullyAnsweredTA6();
    form.section11.q11_7SewerageSystem = {
      source: 'septic-tank', otherDetails: null, location: null, lastServiceDate: null,
      dischargeType: null, infiltrationSystem: 'not-answered', regulationCompliant: 'not-answered',
    };
    // Act + Assert
    expect(calculateTA6Completion(form)).toBeLessThan(100);
  });
});
