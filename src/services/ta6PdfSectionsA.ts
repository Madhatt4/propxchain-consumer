// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * TA6 6th-edition PDF layout — section builders 1..8. Split from
 * ta6PdfSections.ts (which holds 9..15 + the orchestrator) to keep each file
 * under the 300-line cap. Prompts are looked up by question ref from the
 * ADR-0009 paraphrase bundle; no verbatim Law Society wording appears.
 */

import { SECTION_01_PROMPTS } from '../lib/ta6-prompts/section01';
import { SECTION_02_PROMPTS } from '../lib/ta6-prompts/section02';
import { SECTION_03_PROMPTS } from '../lib/ta6-prompts/section03';
import { SECTION_04_PROMPTS } from '../lib/ta6-prompts/section04';
import { SECTION_05_PROMPTS } from '../lib/ta6-prompts/section05';
import { SECTION_06_PROMPTS } from '../lib/ta6-prompts/section06';
import { SECTION_07_PROMPTS } from '../lib/ta6-prompts/section07';
import { SECTION_08_PROMPTS } from '../lib/ta6-prompts/section08';

import {
  TA6_SECTION_TITLES,
  ansRow,
  docRow,
  docsSummary,
  humanizeKebab,
  rawRow,
  respRow,
  textRow,
} from './ta6PdfShared';

import type { PdfRow } from './ta6PdfShared';
import type { PdfSection } from './pdfPrimitives';
import type {
  TA6AlterationTypes,
  TA6PropertyInformation,
  TA6WarrantyItem,
} from '../types/ta6.types';

function alterationSummary(a: TA6AlterationTypes): string | null {
  const ticked: string[] = [];
  if (a.windowsPost2002) ticked.push('replacement windows/doors/glazing (since 2002)');
  if (a.conservatory) ticked.push('conservatory');
  if (a.extension) ticked.push('extension');
  if (a.loftConversion) ticked.push('loft conversion');
  if (a.garageConversion) ticked.push('garage conversion');
  if (a.internalWallsRemoved) ticked.push('internal walls removed/altered');
  if (a.changeOfUse) ticked.push('change of use');
  if (a.structuralRoofWorks) ticked.push('structural roof works');
  if (a.other) ticked.push(a.otherDetails ? `other: ${a.otherDetails}` : 'other');
  return ticked.length ? ticked.join('; ') : null;
}

export function section1(f: TA6PropertyInformation): PdfSection {
  const P = SECTION_01_PROMPTS;
  const s = f.section1;
  const rows: PdfRow[] = [
    textRow(P, '1.propertyAddress', s.propertyAddress),
    textRow(P, '1.postcode', s.postcode),
    textRow(P, '1.uprn', s.uprn),
  ];
  if (s.sellers.length === 0) {
    rows.push(textRow(P, '1.seller.fullName', null));
  } else {
    for (const seller of s.sellers) {
      const parts = [seller.fullName, humanizeKebab(seller.role)];
      if (seller.ownershipOrAuthorityDate) parts.push(`since ${seller.ownershipOrAuthorityDate}`);
      rows.push(rawRow(P, '1.seller.fullName', parts.join(' — ')));
    }
  }
  const c = s.sellerCompany;
  if (c) {
    rows.push(textRow(P, '1.company.companyName', c.companyName));
    rows.push(textRow(P, '1.company.companyNumber', c.companyNumber));
    rows.push(textRow(P, '1.company.director', c.director));
    rows.push(textRow(P, '1.company.countryOfIncorporation', c.countryOfIncorporation));
  }
  const sol = s.solicitor;
  rows.push(textRow(P, '1.solicitor.firmName', sol.firmName));
  rows.push(textRow(P, '1.solicitor.address', sol.address));
  rows.push(textRow(P, '1.solicitor.postcode', sol.postcode));
  rows.push(textRow(P, '1.solicitor.contactName', sol.contactName));
  rows.push(textRow(P, '1.solicitor.email', sol.email));
  rows.push(textRow(P, '1.solicitor.phone', sol.phone));
  return { title: TA6_SECTION_TITLES[0], rows };
}

export function section2(f: TA6PropertyInformation): PdfSection {
  const P = SECTION_02_PROMPTS;
  const s = f.section2;
  const features = s.q2_1Features.length
    ? s.q2_1Features.map((b) => `${humanizeKebab(b.position)}: ${humanizeKebab(b.ownership)}`).join('; ')
    : null;
  return {
    title: TA6_SECTION_TITLES[1],
    rows: [
      textRow(P, '2.1', features),
      textRow(P, '2.2', s.q2_2IrregularDescription),
      respRow(P, '2.3', s.q2_3MovedOrAltered),
    ],
  };
}

export function section3(f: TA6PropertyInformation): PdfSection {
  const P = SECTION_03_PROMPTS;
  const s = f.section3;
  return {
    title: TA6_SECTION_TITLES[2],
    rows: [respRow(P, '3.1', s.q3_1ExistingDisputes), respRow(P, '3.2', s.q3_2PotentialDisputes)],
  };
}

export function section4(f: TA6PropertyInformation): PdfSection {
  const P = SECTION_04_PROMPTS;
  const s = f.section4;
  return {
    title: TA6_SECTION_TITLES[3],
    rows: [
      respRow(P, '4.1', s.q4_1NoticesReceived),
      respRow(P, '4.2', s.q4_2NearbyDevelopment),
      respRow(P, '4.3', s.q4_3NearbyUseChange),
    ],
  };
}

export function section5(f: TA6PropertyInformation): PdfSection {
  const P = SECTION_05_PROMPTS;
  const s = f.section5;
  const rows: PdfRow[] = [
    textRow(P, '5.1', alterationSummary(s.q5_1Alterations)),
    rawRow(P, '5.2', docsSummary(s.q5_2Documents)),
    respRow(P, '5.3', s.q5_3NonResidentialUse),
    respRow(P, '5.4', s.q5_4Breaches),
    respRow(P, '5.5', s.q5_5UnresolvedIssues),
  ];
  const solar = s.q5_6Solar;
  if (solar) {
    const owned =
      solar.ownedOutright === null ? 'ownership not stated' : solar.ownedOutright ? 'owned outright' : 'leased';
    const when = solar.installDate ? `installed ${solar.installDate}` : 'install date not stated';
    rows.push(rawRow(P, '5.6', `Yes (${when}, ${owned})`));
    rows.push(docRow(P, '5.6.i', solar.fitOrSegAgreement));
    rows.push(docRow(P, '5.6.ii', solar.supplyAgreement));
    rows.push(docRow(P, '5.6.iii', solar.electricityBill));
    rows.push(docRow(P, '5.6.mcs', solar.mcsCertificate));
  } else {
    rows.push(textRow(P, '5.6', null));
  }
  rows.push(respRow(P, '5.7', s.q5_7ListedBuilding));
  rows.push(respRow(P, '5.8', s.q5_8ConservationArea));
  rows.push(respRow(P, '5.9', s.q5_9TreePreservationOrder));
  return { title: TA6_SECTION_TITLES[4], rows };
}

export function section6(f: TA6PropertyInformation): PdfSection {
  const P = SECTION_06_PROMPTS;
  const s = f.section6;
  const items: Array<[TA6WarrantyItem, string]> = [
    [s.q6_1NewHomeWarranty, '6.1.new-home-warranty'],
    [s.q6_1DampProofing, '6.1.damp-proofing'],
    [s.q6_1TimberTreatment, '6.1.timber-treatment'],
    [s.q6_1Roofing, '6.1.roofing'],
    [s.q6_1ElectricalWork, '6.1.electrical-work'],
    [s.q6_1WindowsDoors, '6.1.windows-doors'],
    [s.q6_1CentralHeating, '6.1.central-heating'],
    [s.q6_1Underpinning, '6.1.underpinning'],
    [s.q6_1Other, '6.1.other'],
  ];
  const rows: PdfRow[] = [];
  for (const [item, ref] of items) {
    const extra = ref === '6.1.other' && s.q6_1OtherDetails ? s.q6_1OtherDetails : '';
    rows.push(ansRow(P, ref, item.present, extra));
    rows.push(docRow(P, `${ref}.doc`, item.document));
  }
  rows.push(respRow(P, '6.2', s.q6_2Claims));
  rows.push(respRow(P, '6.3', s.q6_3Breaches));
  return { title: TA6_SECTION_TITLES[5], rows };
}

export function section7(f: TA6PropertyInformation): PdfSection {
  const P = SECTION_07_PROMPTS;
  const s = f.section7;
  const rows: PdfRow[] = [ansRow(P, '7.1', s.q7_1DoYouInsure)];
  if (s.q7_1DoYouInsure === 'no') rows.push(textRow(P, '7.1.who-insures', s.q7_1WhoInsuresIfNot));
  rows.push(respRow(P, '7.2', s.q7_2DifficultOrSpecialConditions));
  rows.push(respRow(P, '7.3', s.q7_3Claims));
  return { title: TA6_SECTION_TITLES[6], rows };
}

export function section8(f: TA6PropertyInformation): PdfSection {
  const P = SECTION_08_PROMPTS;
  const s = f.section8;
  return {
    title: TA6_SECTION_TITLES[7],
    rows: [
      respRow(P, '8.1', s.q8_1Flooded),
      respRow(P, '8.2', s.q8_2FloodDefences),
      respRow(P, '8.3', s.q8_3RadonTest),
      docRow(P, '8.3a', s.q8_3aReport),
      ansRow(P, '8.3b', s.q8_3bBelowActionLevel),
      respRow(P, '8.4', s.q8_4RadonRemedialMeasures),
      respRow(P, '8.5', s.q8_5GreenDeal),
      docRow(P, '8.5.bill', s.q8_5CurrentBill),
      respRow(P, '8.6', s.q8_6JapaneseKnotweed),
      ansRow(P, '8.7', s.q8_7KnotweedSurvey),
      docRow(P, '8.7.survey', s.q8_7SurveyDocument),
    ],
  };
}
