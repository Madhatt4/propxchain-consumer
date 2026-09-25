// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Postcode -> TA6 jurisdiction ('england' | 'wales') lookup.
 *
 * Static, offline, no network. Computed once at form creation. The mapping is
 * postcode AREA (leading letters) with DISTRICT-number refinement for the
 * areas that straddle the England-Wales border (CH, SY, HR). Districts that
 * are genuinely mixed are assigned to their MAJORITY side — each such call is
 * commented inline. Because this feeds a legal form, callers should let the
 * user confirm/override the computed value rather than treating it as gospel.
 *
 * Returns null when the input is unparseable OR the postcode is outside
 * England & Wales (Scotland, Northern Ireland, Isle of Man, Channel Islands)
 * — TA6 does not apply there, and failing to a user prompt is safer than
 * guessing.
 */

export type Jurisdiction = 'england' | 'wales';

// Normalised (uppercase, no spaces) shapes: full postcode always ends
// digit + two letters (the inward code); outward code is 2-4 chars.
const FULL_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/;
const OUTWARD_ONLY = /^[A-Z]{1,2}\d[A-Z\d]?$/;
const OUTWARD_PARTS = /^([A-Z]{1,2})(\d{1,2})/;

// Areas lying entirely (or, for every district, majority) within Wales.
// - CF (Cardiff) and SA (Swansea/Carmarthen/Pembroke/Ceredigion): wholly Wales.
// - NP (Newport): every district majority Wales. NP16 (Chepstow) includes the
//   Gloucestershire villages Tutshill/Sedbury/Beachley and NP25 (Monmouth)
//   includes Staunton and part of Redbrook (England), but both districts are
//   dominated by their Welsh towns.
// - LL (Llandudno/Wrexham): every district majority Wales. Minor English
//   fringes exist (e.g. Chirk Bank, Shropshire, in LL14).
// - LD (Llandrindod Wells): every district majority Wales. LD7 (Knighton)
//   includes Llanfair Waterdine and Knighton railway station (Shropshire) and
//   LD8 (Presteigne) a few English border hamlets — small minorities.
const WALES_AREAS: ReadonlySet<string> = new Set(['CF', 'SA', 'NP', 'LL', 'LD']);

// Border areas needing district-level splits. Listed district numbers are
// Wales; every other district in the area is England.
const WALES_DISTRICTS_IN_BORDER_AREAS: ReadonlyMap<string, ReadonlySet<number>> = new Map([
  // CH (Chester): CH1-CH3 Chester and CH41-CH66 Wirral/Ellesmere Port are
  // England. CH5 (Deeside: Connah's Quay/Shotton/Hawarden), CH6 (Flint),
  // CH7 (Mold/Buckley) and CH8 (Holywell) are Flintshire — Wales.
  // CH4 is genuinely mixed and close to 50/50: Handbridge/Lache/Westminster
  // Park (Chester, England) vs Saltney/Broughton/Penyffordd/Higher Kinnerton
  // (Flintshire, Wales). Majority side chosen: England (post town Chester,
  // anchored on the Chester side) — worth a user confirmation for CH4.
  ['CH', new Set([5, 6, 7, 8])],
  // SY (Shrewsbury): SY1-SY14 are Shropshire/Cheshire — England — with mixed
  // fringes assigned to their English majorities: SY5 includes Criggion/Crew
  // Green (Powys); SY10 (rural Oswestry) includes Llanrhaeadr-ym-Mochnant,
  // Llansilin and Llangedwyn (Powys) but is majority England (Weston Rhyn,
  // Morda, Pant, Trefonen); SY13 (Whitchurch) includes the Wrexham Maelor
  // villages Bronington/Hanmer/Bettisfield but Whitchurch town dominates.
  // SY15-SY25 are Powys/Ceredigion — Wales: SY15 (Montgomery/Churchstoke,
  // majority Wales with tiny Shropshire hamlets), SY16 (Newtown),
  // SY17 (Caersws), SY18 (Llanidloes), SY19 (Llanbrynmair),
  // SY20 (Machynlleth), SY21 (Welshpool, small English fringe),
  // SY22 (Llanfyllin/Llansantffraid — Llanymynech village itself straddles
  // the border), SY23/SY24 (Aberystwyth), SY25 (Tregaron).
  ['SY', new Set([15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25])],
  // HR (Hereford): Herefordshire — England — except HR3 (post town
  // Hay-on-Wye). HR3 is genuinely mixed: Hay-on-Wye, Clyro, Glasbury and
  // Llowes (Powys, Wales) vs Clifford, Cusop, Dorstone, Bredwardine and
  // Eardisley (Herefordshire, England). Majority side chosen: Wales — the
  // district's post town and largest settlements sit on the Welsh side.
  // HR5 (Kington) includes Gladestry (Powys) but is majority England.
  ['HR', new Set([3])],
]);

// Areas lying entirely within England. Anything not listed here or above is
// Scotland (AB DD DG EH FK G HS IV KA KW KY ML PA PH TD ZE), Northern Ireland
// (BT), Isle of Man (IM), the Channel Islands (GY JE) or not a real postcode
// area — all of which return null. Note TD is treated as outside England &
// Wales even though TD12/TD15 (Berwick-upon-Tweed side) are England: nulling
// them prompts the user instead of silently mislabelling the Scottish majority.
const ENGLAND_AREAS: ReadonlySet<string> = new Set([
  'AL', 'B', 'BA', 'BB', 'BD', 'BH', 'BL', 'BN', 'BR', 'BS',
  'CA', 'CB', 'CM', 'CO', 'CR', 'CT', 'CV', 'CW',
  'DA', 'DE', 'DH', 'DL', 'DN', 'DT', 'DY',
  'E', 'EC', 'EN', 'EX', 'FY', 'GL', 'GU',
  'HA', 'HD', 'HG', 'HP', 'HU', 'HX', 'IG', 'IP', 'KT',
  'L', 'LA', 'LE', 'LN', 'LS', 'LU', 'M', 'ME', 'MK',
  'N', 'NE', 'NG', 'NN', 'NR', 'NW', 'OL', 'OX',
  'PE', 'PL', 'PO', 'PR', 'RG', 'RH', 'RM',
  'S', 'SE', 'SG', 'SK', 'SL', 'SM', 'SN', 'SO', 'SP', 'SR', 'SS', 'ST', 'SW',
  'TA', 'TF', 'TN', 'TQ', 'TR', 'TS', 'TW', 'UB',
  'W', 'WA', 'WC', 'WD', 'WF', 'WN', 'WR', 'WS', 'WV', 'YO',
]);

/**
 * Extract the outward code (area + district, e.g. "SY21") from a full or
 * outward-only postcode. Stripping the fixed-length inward code from a full
 * postcode FIRST matters: greedy digit-grabbing on a space-less full postcode
 * like "CH51AA" would otherwise read district 51 instead of CH5.
 */
function extractOutwardCode(postcode: string): string | null {
  const normalised = postcode.toUpperCase().replace(/\s+/g, '');
  if (FULL_POSTCODE.test(normalised)) return normalised.slice(0, -3);
  if (OUTWARD_ONLY.test(normalised)) return normalised;
  return null;
}

/**
 * Map a postcode (full "CF10 1AA" or outward-only "CF10", any case/spacing)
 * to its TA6 jurisdiction. Null = unparseable or outside England & Wales.
 */
export function jurisdictionFromPostcode(postcode: string): Jurisdiction | null {
  const outward = extractOutwardCode(postcode);
  if (outward === null) return null;

  const match = OUTWARD_PARTS.exec(outward);
  if (match === null) return null;
  const [, area = '', districtDigits = ''] = match;

  const walesDistricts = WALES_DISTRICTS_IN_BORDER_AREAS.get(area);
  if (walesDistricts !== undefined) {
    return walesDistricts.has(Number(districtDigits)) ? 'wales' : 'england';
  }
  if (WALES_AREAS.has(area)) return 'wales';
  if (ENGLAND_AREAS.has(area)) return 'england';
  return null;
}
