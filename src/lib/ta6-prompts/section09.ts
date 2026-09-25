// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd
//
// TA6 §9 — Rights and informal arrangements (paraphrase bundle, ADR 0009).
// PropXchain-paraphrased prompts keyed by question ref. Never verbatim form
// wording — each entry links to the official form for canonical text.
// Schema source: packages/core/src/transaction_manager/forms_types.mo
// (Section9Rights). 9.1–9.3 = rights the seller exercises over other
// property; 9.4–9.6 = rights others exercise over the seller's property
// (9.5 mirrors 9.2: contributions ASKED OF other owners, possibly paid to a
// third party); 9.7–9.9 = drains, pipes and wires. The repeating Right rows
// (9.1/9.4) and the amounts (9.2/9.5) are structured details of their parent
// question, not separate questions. 9.9's agreement document slot uses the
// synthetic ref 9.9.doc.

import { TA6_OFFICIAL_FORM_URL } from './types';
import type { TA6PromptEntry } from './types';

const ANCHOR = TA6_OFFICIAL_FORM_URL;

export const SECTION_09_PROMPTS: TA6PromptEntry[] = [
  {
    ref: '9.1',
    prompt: 'Do you use or have rights over any neighbouring or shared property — for example a shared driveway, a path across someone else’s land, or shared bins or garden areas? If yes, describe each one.',
    helpText: 'Include informal arrangements as well as legal rights, and say whose property each one affects.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '9.2',
    prompt: 'Do you pay towards the upkeep of anything you use jointly with others — such as a shared drive, private road or shared drains? If yes, say how much you pay and how often.',
    helpText: 'Give the amount and who you pay it to.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '9.3',
    prompt: 'Has there been any disagreement or complaint about the rights or payments described in 9.1 and 9.2? If yes, give details.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '9.4',
    prompt: 'Does anyone else use your property or have rights over it — for example a right of way across your land, or shared use of your drive? If yes, describe each one.',
    helpText: 'Include informal arrangements as well as legal rights. "Not known" is an acceptable answer.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '9.5',
    prompt: 'Do you ask other owners or neighbours to pay towards the upkeep of anything they use jointly with you — such as a shared driveway, private road or drains? If yes, say how much is asked for and how often.',
    helpText: 'Include payments that go to someone else — for example a management company — not just money paid to you.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '9.6',
    prompt: 'Has there been any disagreement or complaint about the rights or payments described in 9.4 and 9.5? If yes, give details.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '9.7',
    prompt: 'Do any of the drains, pipes or wires serving your property cross a neighbour’s land?',
    helpText: '"Not known" is an acceptable answer — most sellers will not have detailed records of underground services.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '9.8',
    prompt: 'Do any drains, pipes or wires serving a neighbour’s property cross your land?',
    helpText: '"Not known" is an acceptable answer.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '9.9',
    prompt: 'Is there any agreement or arrangement — formal or informal — about drains, pipes or wires shared with, or crossing, other property? If yes, describe it and say whether any payment is involved.',
    lawSocietyAnchor: ANCHOR,
  },
  {
    ref: '9.9.doc',
    prompt: 'Attach a copy of any agreement about shared or crossing drains, pipes or wires, or say why it is not available.',
    lawSocietyAnchor: ANCHOR,
  },
];
