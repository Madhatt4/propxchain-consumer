// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd
//
// TA6 §7 — Insurance (paraphrase bundle, ADR 0009).
// PropXchain-paraphrased prompts keyed by question ref. Never verbatim form
// wording — each entry links to the official form for canonical text.
// Schema source: packages/core/src/transaction_manager/forms_types.mo
// (Section7Insurance). 7.1 has a conditional free-text follow-up
// (q7_1WhoInsuresIfNot) keyed with a synthetic dotted ref.

import { TA6_OFFICIAL_FORM_URL } from './types';
import type { TA6PromptEntry } from './types';

const ANCHOR = TA6_OFFICIAL_FORM_URL;

export const SECTION_07_PROMPTS: TA6PromptEntry[] = [
  {
    ref: '7.1',
    prompt: 'Do you insure the property? This means buildings insurance arranged by you.',
    helpText: 'Answer no if someone else arranges the buildings insurance — for example a freeholder or management company — and say who does in the next question.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '7.1.who-insures',
    prompt: 'If you do not insure the property, who does?',
    helpText: 'For example the freeholder, a management company or another joint owner.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '7.2',
    prompt: 'Has insuring the property ever been a problem — for example cover refused, an unusually high premium or excess, or special conditions attached to the policy? If yes, give details.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '7.3',
    prompt: 'Have any buildings insurance claims been made for this property? If yes, give details of each claim.',
    helpText: 'Include what happened, when, and whether the claim was paid. "Not known" is an acceptable answer — for example for claims before you owned the property.',
    lawSocietyAnchor: ANCHOR,
  },
];
