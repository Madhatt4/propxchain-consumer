// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd
//
// TA6 §8 — Environmental matters (paraphrase bundle, ADR 0009).
// PropXchain-paraphrased prompts keyed by question ref. Never verbatim form
// wording — each entry links to the official form for canonical text.
// Schema source: packages/core/src/transaction_manager/forms_types.mo
// (Section8Environmental). Numbering verified against the 6th edition:
// 8.4 IS a standalone question (radon remedial measures undertaken).
// Unnumbered document slots use synthetic dotted refs (8.5.bill, 8.7.survey).

import { TA6_OFFICIAL_FORM_URL } from './types';
import type { TA6PromptEntry } from './types';

const ANCHOR = TA6_OFFICIAL_FORM_URL;

export const SECTION_08_PROMPTS: TA6PromptEntry[] = [
  {
    ref: '8.1',
    prompt: 'Has any part of the property ever flooded? If yes, say when it happened and what type of flooding it was.',
    helpText: 'Types of flooding include river, coastal, surface water (rainwater), groundwater and sewer flooding. "Not known" is an acceptable answer — for example for anything before you owned the property.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '8.2',
    prompt: 'Are there any flood defences at the property — for example flood barriers, air brick covers, non-return valves or pumps? If yes, give details.',
    helpText: '"Not known" is an acceptable answer.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '8.3',
    prompt: 'Has a radon test ever been carried out at the property? If yes, say what the results were.',
    helpText: 'Radon is a naturally occurring radioactive gas found at higher levels in some parts of the country. "Not known" is an acceptable answer.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '8.3a',
    prompt: 'Attach the radon test report, or say why it is not available.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '8.3b',
    prompt: 'Was the radon test result below the recommended action level?',
    helpText: 'The action level is set by the UK Health Security Agency and should be stated in the test report. "Not known" is an acceptable answer.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '8.4',
    prompt: 'Have any remedial measures been carried out at the property to reduce radon levels? If yes, give details of the work.',
    helpText: 'For example a radon sump, extra ventilation or sealing works. "Not known" is an acceptable answer — for example for work done before you owned the property.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '8.5',
    prompt: 'Does the property have a Green Deal plan — energy improvements that are paid off through the electricity bill? If yes, give details of the plan.',
    helpText: 'A buyer normally takes over the remaining Green Deal repayments, so this needs to be disclosed. "Not known" is an acceptable answer.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '8.5.bill',
    prompt: 'Attach a copy of the current electricity bill showing the Green Deal charge, or say why it is not available.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '8.6',
    prompt: 'Is the property affected by Japanese knotweed? If yes, give details.',
    helpText: 'Japanese knotweed is an invasive plant that can damage buildings and be expensive to remove. Only answer "no" if you are confident there is no knotweed at the property, including in its roots underground — otherwise "not known" is the safer, and acceptable, answer.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '8.7',
    prompt: 'Is there a management or eradication plan for Japanese knotweed, or has a professional survey been carried out?',
    helpText: 'A management plan from a specialist contractor often comes with an insurance-backed guarantee that lenders look for.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '8.7.survey',
    prompt: 'Attach the Japanese knotweed management plan or survey report, or say why it is not available.',
    lawSocietyAnchor: ANCHOR,
  },
];
