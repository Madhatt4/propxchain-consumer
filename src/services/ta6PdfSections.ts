// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * TA6 6th-edition PDF layout — section builders 9..15 and the orchestrator
 * that assembles all 15 sections (1..8 live in ta6PdfSectionsA.ts) plus the
 * conveyancer sign-off into the ordered list formExportService renders.
 * Prompts are looked up by question ref from the ADR-0009 paraphrase bundle;
 * no verbatim Law Society wording appears.
 */

import { SECTION_09_PROMPTS } from '../lib/ta6-prompts/section09';
import { SECTION_10_PROMPTS } from '../lib/ta6-prompts/section10';
import { SECTION_11_PROMPTS } from '../lib/ta6-prompts/section11';
import { SECTION_12_PROMPTS } from '../lib/ta6-prompts/section12';
import { SECTION_13_PROMPTS } from '../lib/ta6-prompts/section13';
import { SECTION_14_PROMPTS } from '../lib/ta6-prompts/section14';
import { SECTION_15_PROMPTS } from '../lib/ta6-prompts/section15';

import {
  section1,
  section2,
  section3,
  section4,
  section5,
  section6,
  section7,
  section8,
} from './ta6PdfSectionsA';
import {
  TA6_SECTION_TITLES,
  answerLabel,
  ansRow,
  docRow,
  docsSummary,
  formatPence,
  humanizeKebab,
  rawRow,
  respRow,
  ta6SignOffSection,
  textRow,
} from './ta6PdfShared';

import type { PdfRow } from './ta6PdfShared';
import type { PdfSection } from './pdfPrimitives';
import type {
  TA6MeteredConnection,
  TA6PropertyInformation,
  TA6ServicedPlantConnection,
  TA6WaterConnection,
} from '../types/ta6.types';

// ============================================
// Connection-grid detail summarisers (§12)
// ============================================

function meteredDetail(c: TA6MeteredConnection): string {
  return [c.provider, c.meterLocation && `meter: ${c.meterLocation}`, c.supplyNumber && `supply no: ${c.supplyNumber}`]
    .filter(Boolean)
    .join(', ');
}

function waterDetail(c: TA6WaterConnection): string {
  return [c.provider, c.stopcockLocation && `stopcock: ${c.stopcockLocation}`, c.meterLocation && `meter: ${c.meterLocation}`]
    .filter(Boolean)
    .join(', ');
}

function plantDetail(c: TA6ServicedPlantConnection): string {
  return [c.provider, c.makeModel, c.serviceProvider && `serviced by ${c.serviceProvider}`]
    .filter(Boolean)
    .join(', ');
}

// ============================================
// Section builders (9..15)
// ============================================

function section9(f: TA6PropertyInformation): PdfSection {
  const P = SECTION_09_PROMPTS;
  const s = f.section9;
  const rows: PdfRow[] = [
    respRow(P, '9.1', s.q9_1RightsExercised),
    respRow(P, '9.2', s.q9_2Contributions, formatPence(s.q9_2Amount)),
    respRow(P, '9.3', s.q9_3Disagreements),
    respRow(P, '9.4', s.q9_4OthersRights),
    respRow(P, '9.5', s.q9_5ContributionsReceived, formatPence(s.q9_5Amount)),
    respRow(P, '9.6', s.q9_6Disagreements),
    respRow(P, '9.7', s.q9_7CrossingOtherProperty),
    respRow(P, '9.8', s.q9_8LeadingToOthers),
  ];
  const arr = s.q9_9Arrangement;
  if (arr) {
    const amt = formatPence(arr.contributionAmount);
    rows.push(rawRow(P, '9.9', amt ? `${arr.description} (${amt})` : arr.description));
    rows.push(docRow(P, '9.9.doc', arr.document));
  } else {
    rows.push(textRow(P, '9.9', null));
  }
  return { title: TA6_SECTION_TITLES[8], rows };
}

function section10(f: TA6PropertyInformation): PdfSection {
  const P = SECTION_10_PROMPTS;
  const s = f.section10;
  const arrangements = s.q10_1Arrangements.length ? s.q10_1Arrangements.map(humanizeKebab).join(', ') : null;
  const combined = [arrangements, s.q10_1Details].filter(Boolean).join(' — ') || null;
  return {
    title: TA6_SECTION_TITLES[9],
    rows: [
      textRow(P, '10.1', combined),
      respRow(P, '10.2', s.q10_2PermitRequired),
      respRow(P, '10.3', s.q10_3EvChargingPoint),
      docRow(P, '10.3.consent', s.q10_3InstallConsent),
    ],
  };
}

function section11(f: TA6PropertyInformation): PdfSection {
  const P = SECTION_11_PROMPTS;
  const s = f.section11;
  const rows: PdfRow[] = [
    respRow(P, '11.1', s.q11_1ElectricalWorks),
    ansRow(P, '11.2', s.q11_2ElectricalCertificates),
    docRow(P, '11.2.doc', s.q11_2Document),
    ansRow(P, '11.3', s.q11_3Eicr, s.q11_3Date ? `report dated ${s.q11_3Date}` : ''),
    docRow(P, '11.3.doc', s.q11_3Report),
  ];
  const heating = s.q11_4HeatingSystems;
  if (heating.length) {
    const summary = heating
      .map((h) => humanizeKebab(h.heatingType === 'other' && h.otherDetails ? h.otherDetails : h.heatingType))
      .join(', ');
    rows.push(rawRow(P, '11.4', summary));
    for (const h of heating) rows.push(docRow(P, '11.4.doc', h.certificate));
  } else {
    rows.push(textRow(P, '11.4', null));
  }
  rows.push(ansRow(P, '11.5a', s.q11_5aFoulWaterMains));
  rows.push(ansRow(P, '11.5b', s.q11_5bSurfaceWaterMains));
  rows.push(textRow(P, '11.6', s.q11_6SewerageSource ? humanizeKebab(s.q11_6SewerageSource) : null));
  const sew = s.q11_7SewerageSystem;
  if (sew) {
    const parts = [humanizeKebab(sew.source)];
    if (sew.location) parts.push(sew.location);
    if (sew.dischargeType) parts.push(humanizeKebab(sew.dischargeType));
    parts.push(`infiltration: ${answerLabel(sew.infiltrationSystem)}`);
    parts.push(`compliant: ${answerLabel(sew.regulationCompliant)}`);
    rows.push(rawRow(P, '11.7', parts.join('; ')));
  } else {
    rows.push(textRow(P, '11.7', null));
  }
  return { title: TA6_SECTION_TITLES[10], rows };
}

function section12(f: TA6PropertyInformation): PdfSection {
  const P = SECTION_12_PROMPTS;
  const s = f.section12;
  return {
    title: TA6_SECTION_TITLES[11],
    rows: [
      ansRow(P, '12.electricity', s.mainsElectricity.connected, meteredDetail(s.mainsElectricity)),
      ansRow(P, '12.gas', s.mainsGas.connected, meteredDetail(s.mainsGas)),
      ansRow(P, '12.water', s.mainsWater.connected, waterDetail(s.mainsWater)),
      ansRow(P, '12.sewerage', s.mainsSewerage.connected, s.mainsSewerage.provider ?? ''),
      ansRow(P, '12.treatment-plant', s.smallSewageTreatmentPlant.connected, plantDetail(s.smallSewageTreatmentPlant)),
      ansRow(P, '12.heat-pumps', s.sharedHeatPumps.connected, plantDetail(s.sharedHeatPumps)),
      ansRow(P, '12.telephone', s.telephone.connected, s.telephone.provider ?? ''),
      ansRow(P, '12.broadband', s.broadband.connected, s.broadband.provider ?? ''),
      textRow(P, '12.other', s.otherServices),
    ],
  };
}

function section13(f: TA6PropertyInformation): PdfSection {
  const P = SECTION_13_PROMPTS;
  const s = f.section13;
  const rows: PdfRow[] = [
    respRow(P, '13.1', s.q13_1DependentPurchase),
    respRow(P, '13.2', s.q13_2MovingDateRequirements),
    ansRow(P, '13.3', s.q13_3SellerLivesAtProperty),
    respRow(P, '13.4', s.q13_4OtherOccupiers17Plus),
    ansRow(P, '13.4b', s.q13_4bTenantsOrLodgers),
    ansRow(P, '13.5', s.q13_5VacantPossession),
    ansRow(P, '13.6', s.q13_6OccupiersAgreedSignVacate),
  ];
  const occ = s.q13_7Occupiers;
  if (occ.length) {
    const names = occ.map((o) => (o.age !== null ? `${o.fullName} (age ${o.age})` : o.fullName)).join('; ');
    rows.push(rawRow(P, '13.7', names));
    for (const o of occ) rows.push(docRow(P, '13.7.doc', o.tenancyAgreement));
  } else {
    rows.push(textRow(P, '13.7', null));
  }
  return { title: TA6_SECTION_TITLES[12], rows };
}

function section14(f: TA6PropertyInformation): PdfSection {
  const P = SECTION_14_PROMPTS;
  const s = f.section14;
  const c = s.q14_2Commitments;
  return {
    title: TA6_SECTION_TITLES[13],
    rows: [
      respRow(P, '14.1', s.q14_1ProceedsClearCharges),
      ansRow(P, '14.2a', c.vacantPossession),
      ansRow(P, '14.2b', c.removeSellersItems),
      ansRow(P, '14.2c', c.leaveServiceInfo),
    ],
  };
}

function section15(f: TA6PropertyInformation): PdfSection {
  const P = SECTION_15_PROMPTS;
  const s = f.section15;
  return {
    title: TA6_SECTION_TITLES[14],
    rows: [
      rawRow(P, '15.1', docsSummary(s.q15_1ConsentsAttached)),
      textRow(P, '15.1.attached', s.consentsAttachedList),
      textRow(P, '15.1.to-follow', s.consentsToFollowList),
      textRow(P, '15.1.not-available', s.consentsNotAvailableList),
      textRow(P, '15.notes', s.additionalNotes),
    ],
  };
}

// ============================================
// Orchestrator
// ============================================

/** Ordered TA6 record sections (1..15 + conveyancer sign-off). */
export function buildTA6Sections(form: TA6PropertyInformation): PdfSection[] {
  return [
    section1(form),
    section2(form),
    section3(form),
    section4(form),
    section5(form),
    section6(form),
    section7(form),
    section8(form),
    section9(form),
    section10(form),
    section11(form),
    section12(form),
    section13(form),
    section14(form),
    section15(form),
    ta6SignOffSection(),
  ];
}
