// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Copy for the property check's topic pages: /flood-risk-check and
 * /listed-building-check. Each answers one search question in depth and
 * hands the address on to /property-check, which runs the full report.
 *
 * Plain ESM (.mjs) for the same reason as propertyCheckData.mjs: the React
 * page and the Node prerender both read it, so a crawler and a visitor see
 * the same words and the FAQPage JSON-LD matches the visible questions.
 *
 * Every claim maps to propertyIntelligenceService.ts:
 *  - Flood zone: planning.data.gov.uk `flood-risk-zone` (rivers and sea,
 *    Zones 2/3). Live warnings: Environment Agency flood-monitoring, 10 km.
 *    Surface water, groundwater and reservoir risk are NOT checked.
 *  - Heritage: planning.data.gov.uk `listed-building` (with grade),
 *    `conservation-area`, `scheduled-monument`, `world-heritage-site` and its
 *    buffer zone. Registered parks and gardens are NOT checked.
 *  - All of it is England only.
 *
 * Types live in the sibling propertyCheckSpokesData.d.ts.
 */

export const FLOOD_RISK_SPOKE = {
  route: 'flood-risk-check',
  meta: {
    title: 'Flood Risk Check by Postcode, Free · PropXchain',
    description:
      'Free flood risk check for any address in England: Flood Zone 2 or 3 for rivers and the sea, plus live Environment Agency flood warnings. No sign-up.',
  },
  h1: 'Flood risk check by postcode',
  intro:
    'Enter a house number and postcode to see whether the property sits in Flood Zone 2 or 3 for flooding from rivers and the sea, and whether any Environment Agency flood warnings are in force nearby. Free, instant, no sign-up. England only.',
  sections: [
    {
      id: 'flood-zones',
      heading: 'What Flood Zones 2 and 3 mean',
      paragraphs: [
        'The Environment Agency’s flood map for planning splits England into zones by the chance of flooding from rivers and the sea, ignoring flood defences.',
        'Flood Zone 2 is medium probability: between a 1 in 1,000 and a 1 in 100 chance each year from rivers, or between 1 in 1,000 and 1 in 200 from the sea. Flood Zone 3 is high probability: 1 in 100 or more each year from rivers, or 1 in 200 or more from the sea. Land outside both is Flood Zone 1, the lowest probability.',
      ],
    },
    {
      id: 'flood-warnings',
      heading: 'Live flood warnings',
      paragraphs: [
        'The check also lists any flood alerts, flood warnings and severe flood warnings the Environment Agency has in force within 10 km of the address right now.',
        'A quiet day says nothing about the long-term risk, so read the warnings alongside the flood zone.',
      ],
    },
    {
      id: 'not-covered',
      heading: 'What this check does not cover',
      paragraphs: [
        'Surface water flooding (heavy rain that cannot drain away), groundwater and reservoir flooding are not included. The long-term flood risk service on GOV.UK covers those.',
        'Ask the seller about any past flooding: the TA6 property information form asks directly, and your conveyancer’s environmental search goes into more depth.',
      ],
    },
    {
      id: 'buying',
      heading: 'Why flood risk matters when buying',
      paragraphs: [
        'Flood risk can raise buildings insurance premiums and affect what a lender will accept, so get an insurance quote before you commit. Flood Re helps many homes built before 2009 find affordable cover.',
      ],
    },
  ],
  faqs: [
    {
      q: 'How do I check if a property is in a flood zone?',
      a: 'Enter the house number and postcode on this page. The check looks the address up on the planning flood map and shows Flood Zone 2 or 3 if either applies.',
    },
    {
      q: 'Is Flood Zone 3 a problem when buying?',
      a: 'Not always, but it is the highest probability zone, so check insurance quotes and speak to your lender early. The zones ignore flood defences, which may lower the real risk.',
    },
    {
      q: 'Does the flood check cover Wales or Scotland?',
      a: 'No. The flood zones come from England’s planning data. Natural Resources Wales and SEPA publish flood maps for Wales and Scotland.',
    },
    {
      q: 'Is the flood risk check free?',
      a: 'Yes. It uses free government data, with no account and no email needed.',
    },
  ],
};

export const HERITAGE_SPOKE = {
  route: 'listed-building-check',
  meta: {
    title: 'Listed Building & Conservation Area Check · PropXchain',
    description:
      'Check free if a property in England is listed or in a conservation area, and whether a scheduled monument or world heritage site applies. No sign-up.',
  },
  h1: 'Listed building and conservation area check',
  intro:
    'Enter a house number and postcode to see whether the property is a listed building, sits in a conservation area, or falls within a scheduled monument or world heritage site. Free, instant, no sign-up. England only.',
  sections: [
    {
      id: 'listed-buildings',
      heading: 'What listing means',
      paragraphs: [
        'Historic England lists buildings of special architectural or historic interest in three grades: Grade I, Grade II* and Grade II. Most listed homes are Grade II. The check shows the grade where the list records it.',
        'Listed building consent is needed for works that affect the building’s character, inside or out, and carrying out such works without it is a criminal offence.',
      ],
    },
    {
      id: 'conservation-areas',
      heading: 'What a conservation area means',
      paragraphs: [
        'Councils designate conservation areas to protect the character of a place. Inside one you need permission to demolish most buildings, permitted development rights are narrower, and you must give the council six weeks’ notice before cutting down or pruning most trees.',
        'Some councils go further with an Article 4 direction, which removes specific permitted development rights.',
      ],
    },
    {
      id: 'monuments',
      heading: 'Scheduled monuments and world heritage sites',
      paragraphs: [
        'Scheduled monuments are nationally important sites, and most works on them need scheduled monument consent. World heritage sites and their buffer zones carry extra weight in planning decisions. The check reports both if they apply to the address.',
      ],
    },
    {
      id: 'before-you-buy',
      heading: 'Before you buy a listed home',
      paragraphs: [
        'Ask the seller for the listed building consents behind any past alterations, and your conveyancer will check them. Work done without consent can become the new owner’s problem.',
      ],
    },
  ],
  faqs: [
    {
      q: 'How do I find out if a house is listed?',
      a: 'Enter the house number and postcode on this page. The check looks the address up in the listed building data on planning.data.gov.uk, which comes from Historic England’s National Heritage List for England.',
    },
    {
      q: 'How do I check if a property is in a conservation area?',
      a: 'The same check shows any conservation area the address falls in, using the boundaries councils publish to planning.data.gov.uk. A few councils have not published theirs yet, so if in doubt ask the council.',
    },
    {
      q: 'Does the heritage check cover Wales?',
      a: 'No. The heritage data covers England only. Cadw holds the list of historic buildings in Wales.',
    },
    {
      q: 'Is the listed building check free?',
      a: 'Yes. It uses free government data, with no account and no email needed.',
    },
  ],
};

export const PROPERTY_CHECK_SPOKES = [FLOOD_RISK_SPOKE, HERITAGE_SPOKE];

export function buildSpokeFaqJsonLd(spoke) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: spoke.faqs.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}
