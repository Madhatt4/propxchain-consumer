// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd
//
// TA6 6th edition — Section 4: Notices and proposals (ADR 0009 paraphrase
// bundle). PropXchain-paraphrased prompts keyed by question ref; no verbatim
// form wording appears here. Schema source: Section4Notices in forms_types.mo.

import { TA6_OFFICIAL_FORM_URL } from './types';

import type { TA6PromptEntry } from './types';

export const SECTION_04_PROMPTS: TA6PromptEntry[] = [
  {
    ref: '4.1',
    prompt:
      'Have you received any letters or notices that affect the property, other than routine junk mail — for example from a neighbour, the council or a government body? If yes, give details.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '4.2',
    prompt:
      'Are you aware of any proposals to develop land or buildings near the property — for example new homes, roads or commercial buildings? If yes, give details.',
    helpText:
      "This only asks what you are aware of — 'not known' is an acceptable answer.",
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '4.3',
    prompt:
      'Are you aware of any proposals to change how nearby buildings or land are used — for example a home becoming a business, or farmland being put to a new use? If yes, give details.',
    helpText:
      "This only asks what you are aware of — 'not known' is an acceptable answer.",
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
];
