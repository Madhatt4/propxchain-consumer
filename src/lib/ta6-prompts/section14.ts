// TA6 6th edition — Section 14 (Completion) paraphrased prompts (ADR 0009).
// 14.2 is a set of three completion-day commitments in the schema
// (CompletionCommitments), keyed here as 14.2a / 14.2b / 14.2c.
import { TA6_OFFICIAL_FORM_URL, type TA6PromptEntry } from './types';

export const SECTION_14_PROMPTS: TA6PromptEntry[] = [
  {
    ref: '14.1',
    prompt:
      'Will the money from your sale be enough to pay off every mortgage and secured loan on the property in full? If not, give details.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '14.2a',
    prompt:
      'Do you agree that on the day of completion you will have moved out and will hand the property over empty (vacant possession)?',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '14.2b',
    prompt:
      'Do you agree to remove, before completion, all of your belongings and any rubbish that are not included in the sale — including from any loft, garden, garage, shed or outbuilding?',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '14.2c',
    prompt:
      'Do you agree to leave behind the instructions, manuals and service records for the property’s systems and appliances — for example the heating instructions — so the buyer can use them?',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
];
