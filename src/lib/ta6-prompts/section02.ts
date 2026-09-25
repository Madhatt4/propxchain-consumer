// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd
//
// TA6 6th edition — Section 2: Boundaries (ADR 0009 paraphrase bundle).
// PropXchain-paraphrased prompts keyed by question ref; no verbatim form
// wording appears here. Schema source: Section2Boundaries in forms_types.mo.

import { TA6_OFFICIAL_FORM_URL } from './types';

import type { TA6PromptEntry } from './types';

export const SECTION_02_PROMPTS: TA6PromptEntry[] = [
  {
    ref: '2.1',
    prompt:
      'Standing in the road and facing the property, say who looks after each boundary feature (fence, wall or hedge) — left, right, rear and front: you, a neighbour, shared, or not known.',
    helpText:
      "Answer from what you actually know — 'not known' is an acceptable answer if you are unsure who owns or maintains a boundary.",
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '2.2',
    prompt:
      'If the boundaries are irregular and hard to describe as left/right/rear/front, describe who owns or maintains each one here, or refer to a marked plan.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '2.3',
    prompt:
      'Are you aware of any boundary feature having been moved, or of any land having been added to or taken away from the property? If yes, give details.',
    helpText:
      "This only asks what you are aware of — 'not known' is an acceptable answer.",
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
];
