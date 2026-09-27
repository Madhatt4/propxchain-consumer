// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Content for /resources/selling/ta6-form-explained that appears in both the
 * React page and its static prerender, so the two cannot drift apart.
 *
 * Plain ESM (.mjs) on purpose: imported by the React page via Vite and by
 * scripts/prerender-resources.mjs under Node. Types live in ta6GuideData.d.ts.
 *
 * Section summaries are condensed from the in-app section help cards
 * (src/lib/ta6-prompts/guides) so the guide and the form say the same thing.
 * They paraphrase; no Law Society question wording is reproduced.
 */

export const LAW_SOCIETY_TA6_URL = 'https://www.lawsociety.org.uk/topics/property/ta6-6th-edition';

/**
 * Sections the Law Society names as removed from the 5th edition. Its page says
 * 10 fewer sections but lists these 9, so the copy says "include", not "were".
 */
export const REMOVED_SECTIONS = Object.freeze([
  'Council tax',
  'Asking price',
  'Tenure, ownership and charges',
  'Physical characteristics of the property',
  'Building safety',
  'Restrictive covenants',
  'Coastal erosion',
  'Accessibility',
  'Coalfield or mining area',
]);

export const TA6_SECTIONS = Object.freeze([
  { n: 1, title: 'Property and seller details', asks: 'The address, who is selling, and the firm acting for you. If you are selling for someone else, as an executor or attorney, this is where you say so.', ready: 'Names as on the deeds; the grant of probate or power of attorney if relevant; your conveyancer’s details.' },
  { n: 2, title: 'Boundaries', asks: 'Who looks after each fence, wall or hedge, and whether any boundary has ever been moved.', ready: 'Your title plan, and what you remember about who has repaired each boundary.' },
  { n: 3, title: 'Disputes and complaints', asks: 'Any disputes or complaints about your home or a neighbouring one, including settled ones, and anything that might become one.', ready: 'Letters or emails about any complaint, if you kept them.' },
  { n: 4, title: 'Notices and proposals', asks: 'Official letters or notices about the property, and anything you know about building plans or changes of use nearby.', ready: 'Any notices you received; anything you have seen about nearby planning applications.' },
  { n: 5, title: 'Alterations, planning and building control', asks: 'Extensions, conversions, replacement windows, removed walls, solar panels, and whether the work had the right consents.', ready: 'Planning permissions, building regulations completion certificates, FENSA or similar window certificates, solar panel paperwork.' },
  { n: 6, title: 'Guarantees and warranties', asks: 'Guarantees on the home or past work, such as a new-build warranty, damp proofing, roofing or electrics, and any claims made on them.', ready: 'Warranty certificates and guarantee paperwork.' },
  { n: 7, title: 'Insurance', asks: 'Who insures the building, whether cover has ever been hard to get, and any claims.', ready: 'Your buildings insurance schedule and details of any claims.' },
  { n: 8, title: 'Environmental matters', asks: 'Flooding, radon, Japanese knotweed and any Green Deal plan.', ready: 'Details of any flooding; a radon report or knotweed plan if you have one; an electricity bill if there is a Green Deal plan.' },
  { n: 9, title: 'Rights and informal arrangements', asks: 'Anything shared with neighbours, formally or not: driveways, paths, pipes and wires crossing boundaries, and who pays for upkeep.', ready: 'Details of shared costs and any written agreements.' },
  { n: 10, title: 'Parking', asks: 'How parking works, what any permit costs, and any electric vehicle charger.', ready: 'Permit details; charger paperwork and any consent to install it.' },
  { n: 11, title: 'Services', asks: 'Electrical work, heating and hot water, and drainage, including septic tanks.', ready: 'Electrical certificates or an EICR; boiler service records; septic tank service dates.' },
  { n: 12, title: 'Connection to services', asks: 'Which utilities are connected, who supplies them, and where the meters and stopcock are.', ready: 'Recent electricity and gas bills; where your meters and stopcock are.' },
  { n: 13, title: 'Transaction information', asks: 'Whether you are buying at the same time, any fixed moving dates, and who lives in the property, including tenants or lodgers.', ready: 'Names of everyone aged 17 or over living there; any tenancy or lodger agreement.' },
  { n: 14, title: 'Completion and moving', asks: 'Confirming the sale will clear your mortgage and that the home will be handed over empty, with manuals left behind.', ready: 'A rough mortgage balance; appliance manuals and service records.' },
  { n: 15, title: 'Additional information', asks: 'Copies of the documents mentioned earlier, which are to follow or missing, and room to explain any answer.', ready: 'The consents and certificates referred to in earlier sections.' },
]);
