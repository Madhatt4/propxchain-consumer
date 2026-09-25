// Shared vocabulary for the TA6 6th-edition widget kit.
//
// TA6PromptEntry is the ADR 0009 paraphrase-bundle entry (src/lib/ta6-prompts)
// — PARAPHRASED wording only; verbatim TA6 question text is © The Law Society,
// so each entry links out to the official wording (lawSocietyAnchor) instead
// of reproducing it. Re-exported here so section components and widgets agree
// on one shape by construction.

import type { TA6AnswerValue, TA6DocumentStatus } from '../../../../types/ta6.types';

export type { TA6PromptEntry } from '../../../../lib/ta6-prompts/types';

// 'not-answered' is a draft marker, not a legal answer — it never gets a
// button. A question with no selection simply renders with nothing pressed.
export const ANSWER_LABELS: Readonly<Record<TA6AnswerValue, string>> = {
  yes: 'Yes',
  no: 'No',
  'not-known': 'Not known',
  'not-applicable': 'Not applicable',
  'not-answered': 'Not answered',
};

export const DEFAULT_ANSWER_OPTIONS: readonly TA6AnswerValue[] = ['yes', 'no', 'not-known'];

export type TA6DocumentStatusChoice = Exclude<TA6DocumentStatus, 'not-answered'>;

export const DOCUMENT_STATUS_LABELS: Readonly<Record<TA6DocumentStatusChoice, string>> = {
  attached: 'Attached',
  'to-follow': 'To follow',
  'not-applicable': 'Not applicable',
  'not-available': 'Not available',
};

export const DOCUMENT_STATUS_OPTIONS: readonly TA6DocumentStatusChoice[] = [
  'attached',
  'to-follow',
  'not-applicable',
  'not-available',
];
