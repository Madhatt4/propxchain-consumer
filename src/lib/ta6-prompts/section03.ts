// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd
//
// TA6 6th edition — Section 3: Disputes (ADR 0009 paraphrase bundle).
// PropXchain-paraphrased prompts keyed by question ref; no verbatim form
// wording appears here. Schema source: Section3Disputes in forms_types.mo.

import { TA6_OFFICIAL_FORM_URL } from './types';

import type { TA6PromptEntry } from './types';

export const SECTION_03_PROMPTS: TA6PromptEntry[] = [
  {
    ref: '3.1',
    prompt:
      'Have there been any disputes or complaints about this property or a property nearby — for example over boundaries, noise or shared access? Include past disputes even if they are now settled, and give details.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '3.2',
    prompt:
      'Are you aware of anything that could lead to a dispute about this property or a property nearby in the future? If yes, give details.',
    helpText:
      "This only asks what you are aware of — you are not expected to investigate. 'Not known' is an acceptable answer.",
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
];
