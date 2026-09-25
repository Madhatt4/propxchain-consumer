// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd
//
// TA6 §10 — Parking (paraphrase bundle, ADR 0009).
// PropXchain-paraphrased prompts keyed by question ref. Never verbatim form
// wording — each entry links to the official form for canonical text.
// Schema source: packages/core/src/transaction_manager/forms_types.mo
// (Section10Parking). 10.3 covers the EV charging point; its installation
// consent document slot uses the synthetic ref 10.3.consent.

import { TA6_OFFICIAL_FORM_URL } from './types';
import type { TA6PromptEntry } from './types';

const ANCHOR = TA6_OFFICIAL_FORM_URL;

export const SECTION_10_PROMPTS: TA6PromptEntry[] = [
  {
    ref: '10.1',
    prompt: 'What are the parking arrangements at the property?',
    helpText: 'Choose all that apply: garage, driveway, allocated space, on-road parking, permit parking, none, or other. If "other", give details.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '10.2',
    prompt: 'Is a permit or licence needed to park at or near the property — for example because it is in a controlled parking zone? If yes, explain how permits work and what they cost.',
    helpText: '"Not known" is an acceptable answer.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '10.3',
    prompt: 'Is there an electric vehicle charging point at the property? If yes, give details — for example whether it is owned outright, leased or on a subscription.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '10.3.consent',
    prompt: 'Attach any consent or approval obtained to install the electric vehicle charging point — for example from a landlord, management company or the local authority — or say why it is not available.',
    lawSocietyAnchor: ANCHOR,
  },
];
