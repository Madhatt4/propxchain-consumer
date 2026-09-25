// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd
//
// Plain-English help cards for TA6 sections 1-5 (ADR 0009 paraphrase bundle).
// Lay-person tone; PropXchain wording only — no verbatim form text. Content
// must stay consistent with the per-question prompts in ../section01.ts
// through ../section05.ts.

import type { TA6SectionGuide } from './types';

export const SECTION_GUIDES_01_05: TA6SectionGuide[] = [
  {
    section: 1,
    plainTitle: 'You, your home, your solicitor',
    intro:
      "This one is pure facts — no tricky questions. It covers the address, who is selling, and the firm handling your sale. If you're selling on someone else's behalf, say as an executor or under a power of attorney, this is where you say so.",
    whatYoullNeed: [
      'The full address and postcode of the property',
      'Full names of everyone selling, as they appear on the deeds',
      'If selling for someone else: the grant of probate or power of attorney, so you can give its date',
      "Your solicitor or conveyancer's firm name, address and contact details",
    ],
    reassurance:
      'Nothing here relies on memory or judgement — every detail can be checked against your documents later, so just fill in what you have.',
  },
  {
    section: 2,
    plainTitle: 'Who owns what at the edges',
    intro:
      'Stand in the street facing your home. This section asks who looks after each fence, wall or hedge — left, right, back and front — and whether any boundary has ever been moved. The buyer wants to know which repairs will be theirs and whether the plot matches the plans.',
    whatYoullNeed: [
      'Your title plan or deeds, if you have them to hand',
      'Your own memory of who has repaired or replaced each fence, wall or hedge',
      'Details of any arrangement with a neighbour about a boundary',
    ],
    reassurance:
      "If you genuinely don't know who owns a fence, 'Not known' is an honest answer — and far better than a guess.",
  },
  {
    section: 3,
    plainTitle: 'Any rows with the neighbours',
    intro:
      'Every street has the odd falling-out. This section asks about disputes or complaints involving your home or one nearby — in either direction, including ones long settled — plus anything you think could flare up later. Buyers ask because an unresolved row can come with the house.',
    whatYoullNeed: [
      'Your own memory of any disagreements, even ones settled years ago',
      'Any letters or emails about a complaint, if you kept them',
    ],
    reassurance:
      "You only have to say what you actually know about — if nothing comes to mind, an honest 'no' is a perfectly good answer.",
  },
  {
    section: 4,
    plainTitle: 'Official letters and nearby plans',
    intro:
      'Has anything official landed on the doormat about your home — from the council, a neighbour or a government body? And have you heard of plans to build nearby, or to change how nearby land is used? Buyers want warning of anything that could change the street around them.',
    whatYoullNeed: [
      "Any letters or notices about the property you've kept — routine junk mail doesn't count",
      "Anything you've seen or heard about nearby building plans, even a planning notice on a lamppost",
      'Details of any change of use nearby, like a house becoming a business',
    ],
    reassurance:
      "You're not expected to go out researching — 'Not known' is an honest, acceptable answer if you've heard nothing.",
  },
  {
    section: 5,
    plainTitle: 'Building work and the paperwork',
    intro:
      "Extensions, loft conversions, new windows, knocked-through walls, solar panels — this is where you list what's been changed and dig out the paperwork that goes with it. The buyer's lender will want to see the work was properly approved, so the certificates matter as much as the work.",
    whatYoullNeed: [
      'Planning permissions and building regulations completion certificates for any work done',
      'FENSA or similar certificates for windows and doors replaced since April 2002',
      'Solar panel paperwork: the MCS certificate plus any lease or feed-in tariff agreement',
      'Listed building consents, if your home is listed',
      'What you know about work done before you moved in',
    ],
    reassurance:
      'Missing certificates are really common — say so honestly rather than guessing, and your conveyancer can talk you through the options.',
  },
];
