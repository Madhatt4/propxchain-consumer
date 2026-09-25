// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd
//
// TA6 §6 — Guarantees and warranties (paraphrase bundle, ADR 0009).
// PropXchain-paraphrased prompts keyed by question ref. Never verbatim form
// wording — each entry links to the official form for canonical text.
// Schema source: packages/core/src/transaction_manager/forms_types.mo
// (Section6Guarantees). 6.1 is a fixed checklist; each row has an answer
// plus a document slot for the certificate (ref suffix `.doc`).

import { TA6_OFFICIAL_FORM_URL } from './types';
import type { TA6PromptEntry } from './types';

const ANCHOR = TA6_OFFICIAL_FORM_URL;

export const SECTION_06_PROMPTS: TA6PromptEntry[] = [
  {
    ref: '6.1.new-home-warranty',
    prompt: 'Does the property have a new home warranty, such as a 10-year structural warranty on a new build?',
    helpText: 'Answer yes if a warranty was provided when the home was built, even if it has since expired. "Not known" is an acceptable answer if you are not sure.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '6.1.new-home-warranty.doc',
    prompt: 'Attach the new home warranty certificate or policy, or say why it is not available.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '6.1.damp-proofing',
    prompt: 'Is there a guarantee for damp proofing work carried out at the property?',
    helpText: '"Not known" is an acceptable answer — for example for work done before you owned the property.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '6.1.damp-proofing.doc',
    prompt: 'Attach the damp proofing guarantee, or say why it is not available.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '6.1.timber-treatment',
    prompt: 'Is there a guarantee for timber treatment, such as woodworm or rot treatment?',
    helpText: '"Not known" is an acceptable answer — for example for work done before you owned the property.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '6.1.timber-treatment.doc',
    prompt: 'Attach the timber treatment guarantee, or say why it is not available.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '6.1.roofing',
    prompt: 'Is there a guarantee or warranty for roofing work at the property?',
    helpText: '"Not known" is an acceptable answer — for example for work done before you owned the property.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '6.1.roofing.doc',
    prompt: 'Attach the roofing guarantee or warranty, or say why it is not available.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '6.1.electrical-work',
    prompt: 'Is there a guarantee or warranty for electrical work at the property?',
    helpText: '"Not known" is an acceptable answer — for example for work done before you owned the property.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '6.1.electrical-work.doc',
    prompt: 'Attach the electrical work guarantee or warranty, or say why it is not available.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '6.1.windows-doors',
    prompt: 'Is there a guarantee or warranty for windows, doors or double glazing — for example one backed by an installer scheme?',
    helpText: '"Not known" is an acceptable answer — for example for installations done before you owned the property.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '6.1.windows-doors.doc',
    prompt: 'Attach the windows, doors or glazing guarantee, or say why it is not available.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '6.1.central-heating',
    prompt: 'Is there a guarantee or warranty for the central heating system?',
    helpText: '"Not known" is an acceptable answer — for example for a system installed before you owned the property.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '6.1.central-heating.doc',
    prompt: 'Attach the central heating guarantee or warranty, or say why it is not available.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '6.1.underpinning',
    prompt: 'Is there a guarantee for underpinning work carried out at the property?',
    helpText: '"Not known" is an acceptable answer — for example for work done before you owned the property.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '6.1.underpinning.doc',
    prompt: 'Attach the underpinning guarantee, or say why it is not available.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '6.1.other',
    prompt: 'Is there any other guarantee or warranty relating to the property? If yes, describe what it covers.',
    helpText: 'For example a guarantee for a flat roof, cavity wall insulation or a specific appliance. "Not known" is an acceptable answer.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '6.1.other.doc',
    prompt: 'Attach any other guarantee or warranty document, or say why it is not available.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '6.2',
    prompt: 'Has anyone claimed on any of these guarantees or warranties? If yes, give brief details of each claim and its outcome.',
    helpText: 'Include claims made by previous owners if you know about them. "Not known" is an acceptable answer.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '6.3',
    prompt: 'Are you aware of anything that might break the conditions of any of these guarantees or warranties, or stop a future claim from succeeding? If yes, give details.',
    helpText: 'For example a problem that was never reported, missed servicing, or later work done by someone the guarantee does not cover. You only need to answer from your own awareness — "not known" is an acceptable answer.',
    lawSocietyAnchor: ANCHOR,
  },
];
