// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd
//
// TA6 6th edition — Section 5: Alterations (ADR 0009 paraphrase bundle).
// PropXchain-paraphrased prompts keyed by question ref; no verbatim form
// wording appears here. Schema source: Section5Alterations in forms_types.mo.
// 5.1 is a single prompt covering the whole tick-set (AlterationTypes);
// 5.6 solar sub-parts (i)/(ii)/(iii) and the MCS certificate are separate
// document-slot entries.

import { TA6_OFFICIAL_FORM_URL } from './types';

import type { TA6PromptEntry } from './types';

export const SECTION_05_PROMPTS: TA6PromptEntry[] = [
  {
    ref: '5.1',
    prompt:
      'Which of these changes have been made to the property? Tick all that apply: replacement windows, doors or glazing (fitted since April 2002); a conservatory; an extension; a loft conversion; a garage conversion; internal walls removed or altered; a change of use; structural work to the roof; or anything else (describe it).',
    helpText:
      'Include works done before you owned the property if you know about them. If you tick "other", briefly describe what was done.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '5.2',
    prompt:
      'For each change ticked above, attach the paperwork — planning permission, building regulations approval, completion or competent-person certificates — or say whether it will follow, does not apply, or is not available.',
    helpText:
      'Missing paperwork is common — say so rather than guessing. Your conveyancer can advise on options such as indemnity insurance or retrospective sign-off.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '5.3',
    prompt:
      'Is any part of the property used for something other than ordinary residential living — for example running a business from home? If yes, give details.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '5.4',
    prompt:
      'Are you aware of any of the works or changes breaking the terms of a planning permission or building regulations approval, or of work carried out without a consent that was needed? If yes, give details.',
    helpText:
      "This only asks what you are aware of — 'not known' is an acceptable answer.",
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '5.5',
    prompt:
      'Are there any unfinished works or unresolved planning or building-control issues at the property — for example work still waiting for final sign-off? If yes, give details.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '5.6',
    prompt:
      'Does the property have a solar panel system? If so, tell us when it was installed and whether the panels are owned outright or provided under a lease or similar arrangement.',
    helpText:
      'Leased panels usually mean a long-term agreement with the installer that passes to the buyer — the documents below let their conveyancer check the terms.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '5.6.i',
    prompt:
      'Attach the feed-in tariff (FIT) or smart export guarantee (SEG) agreement for the solar panels, or say why it is not available.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '5.6.ii',
    prompt:
      'Attach the electricity supply agreement connected with the solar panel system, or say why it is not available.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '5.6.iii',
    prompt:
      'Attach a recent electricity bill for the supply linked to the solar panels, or say why it is not available.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '5.6.mcs',
    prompt:
      'Attach the MCS (Microgeneration Certification Scheme) certificate for the solar installation, or say why it is not available.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '5.7',
    prompt:
      'Is the property, or any part of it, a listed building? If yes, give the listing grade.',
    helpText:
      "'Not known' is an acceptable answer — listing status can be checked on the public register.",
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '5.8',
    prompt: 'Is the property in a conservation area?',
    helpText:
      "'Not known' is an acceptable answer — conservation-area status can be checked with the local council.",
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '5.9',
    prompt:
      'Are any of the trees at the property protected by a tree preservation order? If yes, give details.',
    helpText:
      "'Not known' is an acceptable answer — tree preservation orders can be checked with the local council.",
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
];
