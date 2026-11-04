// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * What the report says about an address, as data: which findings stand out
 * and how serious they are, and who to ask about each. Pure, so the on-screen
 * report and its tests read the same answers.
 *
 * The central rule: a HAZARD (flood, surface water, coal, radon, brownfield)
 * can be serious; a CONSTRAINT (listing, conservation area, Article 4, trees,
 * landscape designations) limits what you can change and is never shown as a
 * hazard. Buyers read red as "problem property", so red is for hazards only.
 */

import type { PropertyIntelligenceReport } from '../../../services/propertyIntelligenceService';

export type Severity = 'high' | 'medium' | 'constraint';

export interface Standout {
  key: string;
  severity: Severity;
  title: string;
  detail: string;
  /** Section the finding is explained in, for the jump link. */
  section: ReportSectionId;
}

export type ReportSectionId =
  | 'summary'
  | 'flood'
  | 'ground'
  | 'designations'
  | 'prices'
  | 'energy'
  | 'planning'
  | 'ask';

export interface AskItem {
  q: string;
  why: string;
}

export interface AskLists {
  seller: AskItem[];
  conveyancer: AskItem[];
  surveyor: AskItem[];
}

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, constraint: 2 };

function floodStandouts(r: PropertyIntelligenceReport): Standout[] {
  const out: Standout[] = [];
  const zone = r.floodZone?.status;
  if (zone === 'zone_3') {
    out.push({ key: 'flood-zone', severity: 'high', section: 'flood', title: 'In Flood Zone 3', detail: 'The highest probability zone for flooding from rivers and the sea.' });
  } else if (zone === 'zone_2' || zone === 'zone_present') {
    out.push({
      key: 'flood-zone',
      severity: 'medium',
      section: 'flood',
      title: zone === 'zone_2' ? 'In Flood Zone 2' : 'In a flood risk zone',
      detail: 'On the planning flood map for rivers and the sea.',
    });
  }
  const band = r.surfaceWater?.band;
  if (band === 'high' || band === 'medium') {
    out.push({
      key: 'surface-water',
      severity: band === 'high' ? 'high' : 'medium',
      section: 'flood',
      title: `${band === 'high' ? 'High' : 'Medium'} surface water flood risk`,
      detail: band === 'high' ? 'More than a 3.3% chance each year at this location.' : 'Between a 1% and 3.3% chance each year at this location.',
    });
  }
  const live = (r.flood?.activeWarnings ?? []).filter((w) => w.severity !== 'no_longer_in_force');
  if (live.length > 0) {
    const serious = live.some((w) => w.severity === 'severe_warning' || w.severity === 'warning');
    out.push({
      key: 'flood-warnings',
      severity: serious ? 'high' : 'medium',
      section: 'flood',
      title: `${live.length} flood ${live.length === 1 ? 'warning' : 'warnings'} in force nearby`,
      detail: 'Environment Agency warnings within 10 km right now.',
    });
  }
  return out;
}

function groundStandouts(r: PropertyIntelligenceReport): Standout[] {
  const out: Standout[] = [];
  if (r.coalMining?.inHighRiskArea) {
    out.push({ key: 'coal', severity: 'high', section: 'ground', title: 'Coal mining high risk area', detail: 'Past mining may affect the ground. A CON29M mining search is needed.' });
  }
  const cls = r.radon?.classMax ?? 0;
  if (cls >= 2) {
    out.push({
      key: 'radon',
      severity: cls >= 4 ? 'high' : 'medium',
      section: 'ground',
      title: `Radon class ${cls} of 6 for this 1 km square`,
      detail: 'A radon test gives the answer for the house itself.',
    });
  }
  if (r.brownfield?.status === 'present') {
    out.push({ key: 'brownfield', severity: 'medium', section: 'ground', title: 'On the brownfield land register', detail: 'Previously developed land; ask what the site was used for.' });
  }
  return out;
}

function designationStandouts(r: PropertyIntelligenceReport): Standout[] {
  const out: Standout[] = [];
  const h = r.heritage;
  if (h && h.listedBuildings.length > 0) {
    const grade = h.listedBuildings[0].grade;
    out.push({ key: 'listed', severity: 'constraint', section: 'designations', title: grade ? `Grade ${grade} listed building` : 'Listed building', detail: 'Works that affect its character need listed building consent.' });
  }
  if (h && h.conservationAreas.length > 0) {
    out.push({ key: 'conservation', severity: 'constraint', section: 'designations', title: `In the ${h.conservationAreas[0].name || 'local'} conservation area`, detail: 'Demolition and many outside changes need permission.' });
  }
  if (h && (h.worldHeritageSites?.length ?? 0) > 0) {
    const site = h.worldHeritageSites?.[0];
    const buffer = site?.dataset === 'world-heritage-site-buffer-zone';
    out.push({ key: 'whs', severity: 'constraint', section: 'designations', title: `${buffer ? 'In the buffer zone of' : 'Inside'} ${site?.name || 'a World Heritage Site'}`, detail: 'Carries extra weight in planning decisions.' });
  }
  if (h && (h.scheduledMonuments?.length ?? 0) > 0) {
    out.push({ key: 'monument', severity: 'constraint', section: 'designations', title: 'Scheduled monument', detail: 'Most works need scheduled monument consent.' });
  }
  if (r.article4?.status === 'restricted') {
    out.push({ key: 'article4', severity: 'constraint', section: 'designations', title: 'Article 4 direction applies', detail: 'Some permitted development rights are removed.' });
  }
  if (r.treePreservation?.status === 'present') {
    out.push({ key: 'tpo', severity: 'constraint', section: 'designations', title: 'Tree preservation order', detail: 'Consent is needed to fell or prune protected trees.' });
  }
  return out;
}

/** Every finding that applies, most serious first. Constraints follow hazards. */
export function buildStandouts(r: PropertyIntelligenceReport): Standout[] {
  return [...floodStandouts(r), ...groundStandouts(r), ...designationStandouts(r)].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
}

/** Names of checks that ran and found nothing, for the "came back clear" line. */
export function buildClears(r: PropertyIntelligenceReport): string[] {
  const clear: string[] = [];
  if (r.floodZone?.status === 'none') clear.push('flood zone');
  if (r.surfaceWater && (r.surfaceWater.band === 'low' || r.surfaceWater.band === 'very_low')) clear.push('surface water');
  if (r.coalMining && !r.coalMining.inHighRiskArea) clear.push('coal mining');
  if (r.radon?.classMax === 1) clear.push('radon');
  if (r.brownfield?.status === 'none') clear.push('brownfield');
  if (r.heritage?.status === 'none') clear.push('heritage');
  if (r.article4?.status === 'none') clear.push('Article 4');
  if (r.treePreservation?.status === 'none') clear.push('protected trees');
  return clear;
}

function hasFloodConcern(r: PropertyIntelligenceReport): boolean {
  const zone = r.floodZone?.status;
  const band = r.surfaceWater?.band;
  return (zone !== undefined && zone !== 'none') || band === 'high' || band === 'medium';
}

/** Questions for each person in the move, driven by what the checks found. */
export function buildAskLists(r: PropertyIntelligenceReport): AskLists {
  const flood = hasFloodConcern(r);
  const radon = r.radon?.classMax ?? 0;
  const heritage = Boolean(r.heritage && r.heritage.status !== 'none');
  const coal = Boolean(r.coalMining?.inHighRiskArea);
  const lists: AskLists = { seller: [], conveyancer: [], surveyor: [] };

  if (flood) {
    lists.seller.push({ q: 'Has the property ever flooded, inside or in the garden?', why: 'The TA6 form asks this directly, and the flood checks above are not clear.' });
    lists.seller.push({ q: 'What does the buildings insurance cost, and is there a flood excess?', why: 'Shows how insurers price the flood risk here.' });
    lists.conveyancer.push({ q: 'Check the environmental search for flood risk and its effect on insurance.', why: 'Confirms the free checks for the house itself.' });
    lists.surveyor.push({ q: 'Look for past flood damage, tide marks and damp at low level.', why: 'Flood checks above are not clear.' });
  }
  if (radon >= 2) {
    lists.seller.push({ q: 'Has a radon test been done, and were any radon measures fitted?', why: `The TA6 form asks about radon. This square is class ${radon} of 6.` });
    if (radon >= 3) lists.surveyor.push({ q: 'Note any radon sump or membrane, and how the ground floor is built.', why: `Radon class ${radon} of 6.` });
  }
  if (coal) {
    lists.conveyancer.push({ q: 'Order a CON29M coal mining search.', why: 'The address is in a coal mining high risk area.' });
    lists.surveyor.push({ q: 'Look for signs of ground movement, such as cracking or sloping floors.', why: 'Coal mining high risk area.' });
  }
  if (heritage || r.article4?.status === 'restricted') {
    lists.seller.push({ q: 'Which alterations have been made, and is there consent for each?', why: 'Heritage or Article 4 rules apply here.' });
    lists.conveyancer.push({ q: 'Check the local search for listing and conservation area conditions.', why: 'Listing applies building by building.' });
  }
  if (heritage) {
    lists.surveyor.push({ q: 'Advise on repairs that need like-for-like materials.', why: 'Heritage rules can dictate materials.' });
  }
  if (r.treePreservation?.status === 'present') {
    lists.seller.push({ q: 'Has any work been done to protected trees, and was consent given?', why: 'A tree preservation order applies.' });
  }
  if (r.brownfield?.status === 'present') {
    lists.conveyancer.push({ q: 'Ask what the land was used for before, and whether it was cleaned up.', why: 'The site is on the brownfield register.' });
  }
  if (r.planningApplications?.status === 'many') {
    lists.conveyancer.push({ q: 'Review the nearby planning applications for anything that affects the property.', why: `${r.planningApplications.total} applications nearby.` });
  }
  const band = r.epc?.currentBand;
  if (band && 'EFG'.includes(band)) {
    lists.surveyor.push({ q: 'Comment on insulation, windows and the heating system.', why: `The energy rating is ${band}.` });
  }

  // Asked whatever the checks found.
  lists.seller.push({ q: 'Are there any disputes or complaints with neighbours?', why: 'The TA6 form asks, and it rarely shows in public data.' });
  lists.conveyancer.push({ q: 'Order the local authority, drainage and environmental searches.', why: 'These free checks are indicative; the searches are the record.' });
  lists.surveyor.push({ q: 'Report on the roof, walls and any damp.', why: 'Public data cannot see the condition of the building.' });
  return lists;
}
