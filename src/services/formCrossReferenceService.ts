// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * v3 Property Intelligence cross-reference engine (Ship 3f).
 *
 * Pure-TS rules engine that compares TA6/TA7 seller-form answers with the
 * PropertyIntelligenceReport built in Ship 3a–3e. Emits a list of
 * CrossReferenceResult flags which the form pages render inline as anomaly
 * indicators.
 *
 * No network, no localStorage, no React — a pure function per form.
 *
 * See docs/Upgrades/propxchain-v3-roadmap.md Task 3.3 (lines 1265–1319).
 */
import type {
  PropertyIntelligenceReport,
  HeritageData,
} from './propertyIntelligenceService';
import type { TA6PropertyInformation } from '../types/ta6.types';
import type { TA7LeaseholdInformation } from '../types/ta7.types';
import { calculateRemainingLeaseYears } from '../types/ta7.types';

export interface CrossReferenceResult {
  /** Human-readable form section label — e.g. "TA6 §7 Environmental" */
  formSection: string;
  /** The field on the form that triggered the flag */
  formField: string;
  /** What the user entered */
  formValue: unknown;
  /** Provenance — which API inside the intel report this compared against */
  propertyIntelSource: string;
  /** What the intel says */
  propertyIntelValue: unknown;
  conflictType: 'contradiction' | 'missing' | 'verification' | 'info';
  severity: 'info' | 'warning' | 'critical';
  /** Short description surfaced in the UI */
  message: string;
  /** What the user should do next */
  suggestedAction: string;
}

const SEVERITY_RANK: Record<CrossReferenceResult['severity'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function sortBySeverity(results: CrossReferenceResult[]): CrossReferenceResult[] {
  return [...results].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

// ============================================
// TA6 rules
// ============================================

function floodHistoryContradictionRule(
  form: TA6PropertyInformation,
  report: PropertyIntelligenceReport,
): CrossReferenceResult | null {
  const zoneStatus = report.floodZone?.status;
  if (!zoneStatus || zoneStatus === 'none') return null;

  // §8.1 is the explicit "has any part of the property ever flooded?" question.
  // Only an outright "no" contradicts a mapped flood zone; not-answered (draft),
  // not-known and yes do not. 6th-edition equivalent of roadmap rule 3.3.
  if (form.section8.q8_1Flooded.answer !== 'no') return null;

  return {
    formSection: 'TA6 §8 Environmental matters',
    formField: 'section8.q8_1Flooded',
    formValue: form.section8.q8_1Flooded.answer,
    propertyIntelSource: 'planning.data.gov.uk/flood-zone',
    propertyIntelValue: zoneStatus,
    conflictType: 'contradiction',
    severity: 'critical',
    message: `Property sits in ${humanFloodZone(zoneStatus)} but §8.1 declares it has never flooded.`,
    suggestedAction: 'Review the §8.1 flooding answer against the flood-zone designation.',
  };
}

function activeFloodWarningRule(
  report: PropertyIntelligenceReport,
): CrossReferenceResult | null {
  const status = report.flood?.status;
  if (!status || (status !== 'high' && status !== 'medium')) return null;
  const count = report.flood?.activeWarnings.length ?? 0;
  return {
    formSection: 'TA6 §8 Environmental matters',
    formField: 'flood',
    formValue: null,
    propertyIntelSource: 'environment.data.gov.uk/flood',
    propertyIntelValue: { status, activeWarnings: count },
    conflictType: 'info',
    severity: 'warning',
    message:
      count > 0
        ? `Environment Agency has ${count} active flood ${count === 1 ? 'warning' : 'warnings'} near this property.`
        : 'Environment Agency reports elevated flood risk near this property.',
    suggestedAction: 'Raise with buyer during negotiation — may affect insurance premiums.',
  };
}

function alterationsClaimedNoneButApprovedExistRule(
  form: TA6PropertyInformation,
  report: PropertyIntelligenceReport,
): CrossReferenceResult | null {
  const apps = report.planningApplications;
  if (!apps || apps.applications.length === 0) return null;

  // §5.1 is a tick-all-that-apply list of alteration types; "no alterations"
  // means none are ticked. The defaults leave them all false, so we only flag
  // when the seller has otherwise engaged §5 (answered one of its yes/no
  // questions) — an untouched draft must not false-positive on nearby works.
  const s5 = form.section5;
  const alt = s5.q5_1Alterations;
  const anyAlterationTicked =
    alt.windowsPost2002 || alt.conservatory || alt.extension || alt.loftConversion ||
    alt.garageConversion || alt.internalWallsRemoved || alt.changeOfUse ||
    alt.structuralRoofWorks || alt.other;
  if (anyAlterationTicked) return null;
  const engagedSection5 = [
    s5.q5_3NonResidentialUse, s5.q5_4Breaches, s5.q5_5UnresolvedIssues,
    s5.q5_7ListedBuilding, s5.q5_8ConservationArea, s5.q5_9TreePreservationOrder,
  ].some((r) => r.answer !== 'not-answered');
  if (!engagedSection5) return null;

  const approved = apps.applications.filter((a) => {
    const s = a.appState.toLowerCase();
    return s.includes('approved') || s.includes('granted') || s.includes('permitted');
  });
  if (approved.length === 0) return null;

  return {
    formSection: 'TA6 §5 Alterations, planning and building control',
    formField: 'section5.q5_1Alterations',
    formValue: false,
    propertyIntelSource: 'planit.org.uk',
    propertyIntelValue: { approvedNearby: approved.length, total: apps.total },
    conflictType: 'contradiction',
    severity: 'warning',
    message: `Seller has not ticked any alterations at §5.1 but UK PlanIt shows ${approved.length} approved planning ${approved.length === 1 ? 'record' : 'records'} within 300m.`,
    suggestedAction: 'Planning records show approved works nearby. Please clarify whether these relate to this property.',
  };
}

function conservationAreaRule(
  heritage: HeritageData | null,
): CrossReferenceResult | null {
  if (!heritage) return null;
  if (heritage.status !== 'in_conservation_area' && heritage.status !== 'both') return null;
  return {
    formSection: 'TA6 §5 Alterations, planning and building control',
    formField: 'section5.q5_8ConservationArea',
    formValue: null,
    propertyIntelSource: 'planning.data.gov.uk/heritage',
    propertyIntelValue: { conservationAreas: heritage.conservationAreas.length },
    conflictType: 'info',
    severity: 'info',
    message: `Property is in a conservation area (${heritage.conservationAreas.length} designated).`,
    suggestedAction: 'Boundary or external changes may need conservation-area consent.',
  };
}

function listedBuildingRule(
  heritage: HeritageData | null,
): CrossReferenceResult | null {
  if (!heritage) return null;
  if (heritage.status !== 'listed_building' && heritage.status !== 'both') return null;
  return {
    formSection: 'TA6 §5 Alterations, planning and building control',
    formField: 'section5.q5_7ListedBuilding',
    formValue: null,
    propertyIntelSource: 'planning.data.gov.uk/heritage',
    propertyIntelValue: { listedBuildings: heritage.listedBuildings.length },
    conflictType: 'info',
    severity: 'info',
    message: `Listed building${heritage.listedBuildings.length === 1 ? '' : 's'} recorded at this postcode.`,
    suggestedAction: 'Alterations to a listed building require listed building consent.',
  };
}

function environmentalDesignationRule(
  report: PropertyIntelligenceReport,
): CrossReferenceResult | null {
  const env = report.environmental;
  if (!env || env.status === 'none') return null;

  const labels = env.designations.map((d) => humanDatasetLabel(d.dataset));
  const unique = Array.from(new Set(labels));
  const joined = unique.join(', ');
  return {
    formSection: 'TA6 §8 Environmental matters',
    formField: 'section8',
    formValue: null,
    propertyIntelSource: 'planning.data.gov.uk/environmental',
    propertyIntelValue: { designations: unique },
    conflictType: 'info',
    severity: 'info',
    message: `Property sits in ${joined}.`,
    suggestedAction: `Check planning constraints for ${joined} before any works.`,
  };
}

// ============================================
// TA7 rules
// ============================================

function leaseUnder80YearsRule(
  form: TA7LeaseholdInformation,
): CrossReferenceResult | null {
  if (!form.leaseExpiryDate) return null;
  const remaining = calculateRemainingLeaseYears(form.leaseExpiryDate);
  if (remaining === 0) return null; // unset / zeroed — don't fire
  if (remaining >= 80) return null;
  return {
    formSection: 'TA7 Lease Term',
    formField: 'leaseExpiryDate',
    formValue: form.leaseExpiryDate,
    propertyIntelSource: 'derived:termRemainingYears',
    propertyIntelValue: remaining,
    conflictType: 'verification',
    severity: 'critical',
    message: `Lease has ${remaining} years remaining — below the 80-year mortgage threshold.`,
    suggestedAction:
      'Lease under 80 years materially impacts mortgage availability. Consider extension before exchange.',
  };
}

function onerousGroundRentRule(
  form: TA7LeaseholdInformation,
): CrossReferenceResult | null {
  // Roadmap spec asked for "ground rent > £250 AND escalating". TA7 form has
  // no escalating field, so we flag on amount alone. Tracked in commit notes.
  const amount = form.groundRentAmount;
  if (!amount || amount <= 250) return null;
  const freq = form.groundRentPaymentFrequency || 'annual';
  return {
    formSection: 'TA7 Ground Rent',
    formField: 'groundRentAmount',
    formValue: amount,
    propertyIntelSource: 'form:groundRentAmount',
    propertyIntelValue: { amount, frequency: freq },
    conflictType: 'verification',
    severity: 'warning',
    message: `Ground rent of £${amount} (${freq}) may be classed as "onerous" by some lenders.`,
    suggestedAction:
      'Verify with mortgage broker — some lenders refuse ground rent > £250 or with escalation clauses.',
  };
}

// ============================================
// Helpers
// ============================================

function humanFloodZone(status: NonNullable<PropertyIntelligenceReport['floodZone']>['status']): string {
  switch (status) {
    case 'zone_3':
      return 'Flood Zone 3 (high risk)';
    case 'zone_2':
      return 'Flood Zone 2 (medium risk)';
    case 'zone_present':
      return 'a designated flood risk zone';
    default:
      return 'a flood risk zone';
  }
}

function humanDatasetLabel(dataset: string): string {
  switch (dataset) {
    case 'green-belt':
      return 'Green Belt';
    case 'site-of-special-scientific-interest':
      return 'an SSSI';
    case 'area-of-outstanding-natural-beauty':
      return 'an AONB';
    case 'national-park':
      return 'a National Park';
    case 'ancient-woodland':
      return 'Ancient Woodland';
    default:
      return dataset;
  }
}

// ============================================
// Public API
// ============================================

export function crossReferenceTA6(
  form: TA6PropertyInformation | null,
  report: PropertyIntelligenceReport | null,
): CrossReferenceResult[] {
  if (!form || !report) return [];
  const out: CrossReferenceResult[] = [];

  const floodContradiction = floodHistoryContradictionRule(form, report);
  if (floodContradiction) out.push(floodContradiction);

  const activeFlood = activeFloodWarningRule(report);
  if (activeFlood) out.push(activeFlood);

  const noAlterations = alterationsClaimedNoneButApprovedExistRule(form, report);
  if (noAlterations) out.push(noAlterations);

  const conservation = conservationAreaRule(report.heritage);
  if (conservation) out.push(conservation);

  const listed = listedBuildingRule(report.heritage);
  if (listed) out.push(listed);

  const env = environmentalDesignationRule(report);
  if (env) out.push(env);

  return sortBySeverity(out);
}

export function crossReferenceTA7(
  form: TA7LeaseholdInformation | null,
  report: PropertyIntelligenceReport | null,
): CrossReferenceResult[] {
  if (!form) return [];
  const out: CrossReferenceResult[] = [];

  const shortLease = leaseUnder80YearsRule(form);
  if (shortLease) out.push(shortLease);

  const onerous = onerousGroundRentRule(form);
  if (onerous) out.push(onerous);

  // Intel-aware rules on TA7 could be added here (e.g. ground-rent comparison
  // against comparable leaseholds on the postcode). None in Ship 3f.
  void report;

  return sortBySeverity(out);
}

export function crossReferenceAll(
  ta6: TA6PropertyInformation | null,
  ta7: TA7LeaseholdInformation | null,
  report: PropertyIntelligenceReport | null,
): CrossReferenceResult[] {
  return sortBySeverity([
    ...crossReferenceTA6(ta6, report),
    ...crossReferenceTA7(ta7, report),
  ]);
}
