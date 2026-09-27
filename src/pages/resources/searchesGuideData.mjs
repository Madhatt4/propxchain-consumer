// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Content for /resources/searches-and-legal/property-searches-explained that
 * appears in both the React page and its static prerender, so the two cannot
 * drift apart.
 *
 * Plain ESM (.mjs) on purpose: imported by the React page via Vite and by
 * scripts/prerender-resources.mjs under Node. Types live in
 * searchesGuideData.d.ts.
 *
 * Turnarounds are deliberately qualitative: there is no official national
 * figure for council search times, and the guide should not invent one.
 */

export const HMLR_ANNUAL_REPORT_URL =
  'https://www.gov.uk/government/publications/hm-land-registry-annual-report-and-accounts-2025-to-2026/annual-report-and-accounts-2025-to-2026-html';

/** HM Land Registry Annual Report and Accounts 2025 to 2026. */
export const LLC_MIGRATION = Object.freeze({ migrated: 147, total: 331, targetYear: '2028–29' });

export const SEARCHES_AT_A_GLANCE = Object.freeze([
  { name: 'Local authority search (LLC1 + CON29)', tells: 'Charges registered against the property, planning and building control history, road schemes, and council notices.', when: 'Almost every purchase; a mortgage lender will expect it.', speed: 'Days to several weeks, depending on the council.' },
  { name: 'Drainage and water (CON29DW)', tells: 'Whether the home is on mains water and sewers, and whether a public sewer runs within the boundary.', when: 'Almost every purchase.', speed: 'Usually quicker than the local search.' },
  { name: 'Environmental', tells: 'Contaminated land, former landfill, flood risk and radon.', when: 'Strongly recommended, and often required by lenders.', speed: 'Usually fast: it is a report built from existing data.' },
  { name: 'Title register and plan', tells: 'Who owns the property, the boundaries on the plan, rights, and mortgages secured on it.', when: 'Every registered property.', speed: 'Instant from HM Land Registry.' },
  { name: 'Coal mining (CON29M)', tells: 'Recorded mine shafts, past workings, subsidence claims and mine gas.', when: 'Properties in former coalfield areas.', speed: 'Usually a few days.' },
  { name: 'Chancel repair', tells: 'Whether the property may be liable to contribute to repairing a parish church chancel.', when: 'Properties in parishes where the liability can exist.', speed: 'Usually quick.' },
]);

/**
 * Cheapest OneSearch pack (local authority + drainage and water + environmental),
 * VAT inclusive. Must equal onesearchPacks[0].rrpPence in
 * src/services/searchProviderData.ts; a test enforces it.
 */
export const CORE_PACK_FROM = '£259.20';
