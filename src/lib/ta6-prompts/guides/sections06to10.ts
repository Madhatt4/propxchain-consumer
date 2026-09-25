// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd
//
// Plain-English help cards for TA6 sections 6-10 (guides bundle, ADR 0009).
// Lay-person tone; never verbatim form wording. Content must stay consistent
// with the paraphrase prompts in ../section06.ts through ../section10.ts.

import type { TA6SectionGuide } from './types';

export const SECTION_GUIDES_06_10: TA6SectionGuide[] = [
  {
    section: 6,
    plainTitle: 'Guarantees the buyer inherits',
    intro:
      'This section asks about guarantees and warranties on the home and past work — a new-build warranty, damp proofing, timber treatment, roofing, electrics, windows, central heating or underpinning. The buyer cares because many of these pass to them when they buy. It also asks if anyone has claimed on them, or done anything that might stop a future claim.',
    whatYoullNeed: [
      'Your new home warranty certificate, if the house came with one (for example a 10-year structural warranty)',
      'Certificates for replaced windows or doors (often issued by the installer scheme)',
      'Guarantee paperwork for damp proofing, timber treatment, roofing or electrical work',
      'Any letters or emails about claims made on these guarantees',
    ],
    reassurance:
      'If work was done before you owned the home, "Not known" is an honest, acceptable answer — better than guessing.',
  },
  {
    section: 7,
    plainTitle: 'Insuring the building',
    intro:
      'This asks who arranges the buildings insurance — you, or someone like a freeholder or management company. It also asks whether insuring the home has ever been difficult (cover refused, a steep premium, or special conditions) and whether any claims have been made. Buyers care because they will need to insure it themselves from the moment contracts are exchanged.',
    whatYoullNeed: [
      'Your buildings insurance schedule or policy document',
      'Details of any claims — what happened, when, and whether the insurer paid out',
      'Anything in writing about refused cover or special policy conditions',
    ],
    reassurance:
      'For anything that happened before you owned the home — like old claims — "Not known" is an honest, acceptable answer.',
  },
  {
    section: 8,
    plainTitle: 'Flooding, radon and knotweed',
    intro:
      'This is about the ground the home sits on. It asks whether the home has ever flooded and what defences exist, whether a radon test was done (radon is a natural gas, higher in some areas) and any work carried out to reduce it, and whether Japanese knotweed affects the property. It also asks about a Green Deal plan — energy improvements paid off through the electricity bill.',
    whatYoullNeed: [
      'Dates and details of any flooding, even minor',
      'The radon test report, if a test was ever done',
      'A recent electricity bill, if you have a Green Deal plan',
      'The knotweed survey or management plan, if you have one',
    ],
    reassurance:
      '"Not known" is an honest, acceptable answer — especially for anything from before your time, and for knotweed it is safer than a confident "no" you cannot back up.',
  },
  {
    section: 9,
    plainTitle: 'Shared access, shared costs',
    intro:
      'This is about anything shared with neighbours, formal or not — you using their land (a shared driveway, a path across their garden), them using yours, and any drains, pipes or wires crossing the boundary in either direction. It also asks whether anyone chips in for upkeep, both ways. Buyers want to know what comes with the property — and what obligations come with it.',
    whatYoullNeed: [
      'Details of anything you pay towards — the amount, how often, and who you pay',
      'Details of anything neighbours pay towards, even if the money goes to a management company',
      'Any written agreement about shared drains, pipes or wires',
      'Your own knowledge of informal arrangements, like taking turns clearing a shared drive',
    ],
    reassurance:
      'Few people know where every underground pipe runs, so "Not known" is an honest, acceptable answer where you genuinely do not know.',
  },
  {
    section: 10,
    plainTitle: 'Where the cars go',
    intro:
      'This asks how parking works at the home: garage, driveway, an allocated space, on the road, or a permit scheme — and what permits cost if you need one. It also asks about any electric vehicle charging point: whether it is owned, leased or on a subscription, and whether permission was needed to install it. Buyers want no surprises when they pull up with the removal van.',
    whatYoullNeed: [
      'Your parking permit details and what you pay for them, if you have one',
      'The paperwork for your EV charger, if you have one — owned outright, leased or subscription',
      'Any consent you got to install the charger, for example from a landlord or management company',
    ],
    reassurance:
      'If you are unsure about something like local permit rules, "Not known" is an honest, acceptable answer — better than guessing.',
  },
];
