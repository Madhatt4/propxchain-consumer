// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Copy for /property-check — single source of truth.
 *
 * Plain ESM (.mjs) on purpose: imported by BOTH the React page
 * (src/pages/PropertyCheckPage.tsx, via Vite) and the Node prerender script
 * (scripts/prerender-marketing.mjs). A crawler reading the static HTML and a
 * person using the page must be told the same thing, and the FAQPage JSON-LD
 * must match the visible questions exactly.
 *
 * Every claim here maps to PropertyIntelligenceCard and its services. Keep it
 * that way when the report changes:
 *  - Flood zone: planning.data.gov.uk flood-risk-zone (rivers and sea, Zones 2/3).
 *  - Flood warnings: Environment Agency live warnings within 10 km.
 *    Surface-water and long-term risk bands are NOT covered, so the copy says so
 *    and points to the GOV.UK service rather than implying it.
 *  - Heritage: conservation area, listed building, park and garden, scheduled
 *    monument, world heritage site (planning.data.gov.uk, England only).
 *  - Sold prices: HM Land Registry price paid (England and Wales).
 *  - Planning applications: UK PlanIt. EPC: the energy certificate register.
 *
 * Types live in the sibling propertyCheckData.d.ts.
 */

export const PROPERTY_CHECK_META = {
  title: 'Free Property Check by Postcode · PropXchain',
  description:
    'Check any address free: flood zone, flood warnings, listed building and conservation area status, planning, sold prices and EPC. Instant, no sign-up.',
};

export const PROPERTY_CHECK_HERO = {
  h1: 'Free property check for any address',
  intro:
    'Enter a house number and postcode to see flood zone, live flood warnings, listed building and conservation area status, planning applications, sold prices and the energy rating. Pulled live from official sources. No sign-up, no email.',
};

export const PROPERTY_CHECK_COVERS = [
  { label: 'Flood zone', body: 'Whether the property sits in Flood Zone 2 or 3 on the planning flood map for rivers and the sea.' },
  { label: 'Flood warnings', body: 'Live Environment Agency flood warnings and alerts within 10 km.' },
  { label: 'Heritage', body: 'Listed building, conservation area, registered park and garden, scheduled monument and world heritage site.' },
  { label: 'Environment', body: 'Green belt, SSSI, national park, ancient woodland and Areas of Outstanding Natural Beauty.' },
  { label: 'Planning', body: 'Recent planning applications nearby, plus tree preservation orders and brownfield land.' },
  { label: 'Sold prices', body: 'What homes on the street sold for, from HM Land Registry price paid data.' },
  { label: 'Energy (EPC)', body: 'The current energy rating and floor area from the EPC register.' },
];

export const PROPERTY_CHECK_SECTIONS = [
  {
    id: 'flood-risk',
    heading: 'Check flood risk by postcode',
    paragraphs: [
      'The check shows whether the address falls inside Flood Zone 2 or Flood Zone 3, the Environment Agency zones used in planning for flooding from rivers and the sea. Flood Zone 3 is the highest probability. It also lists any flood warnings in force within 10 km right now.',
      'It does not show surface water (flash flooding) risk. For that, use the long-term flood risk service on GOV.UK, and ask the seller about any past flooding on the TA6 form.',
    ],
  },
  {
    id: 'heritage',
    heading: 'Is the property listed or in a conservation area?',
    paragraphs: [
      'The check reports whether the address is a listed building or sits in a conservation area, a registered park and garden, a scheduled monument or a world heritage site.',
      'Listing and conservation area status limit what you can change, from windows to extensions, and some works need consent. Knowing before you offer saves a surprise at the searches stage.',
    ],
  },
];

export const PROPERTY_CHECK_FAQS = [
  {
    q: 'Is the property check really free?',
    a: 'Yes. It uses free open government data, so there is nothing to pay and no account to create. Use Download on the report to save it as a PDF.',
  },
  {
    q: 'Which areas does it cover?',
    a: 'Sold prices and energy ratings cover England and Wales. Flood zone, heritage and other planning designations come from England’s planning data, so they are not yet available for addresses in Wales.',
  },
  {
    q: 'Does this replace property searches?',
    a: 'No. It is a quick first look. A conveyancer still orders the official local authority, drainage and environmental searches before exchange.',
  },
  {
    q: 'Where does the data come from?',
    a: 'HM Land Registry, the Environment Agency, planning.data.gov.uk, the EPC register and UK PlanIt. Each section of the report names its source.',
  },
];

export function buildPropertyCheckFaqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: PROPERTY_CHECK_FAQS.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}
