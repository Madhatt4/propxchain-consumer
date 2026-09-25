// TA6 6th edition — Section 15 (Additional information) paraphrased prompts
// (ADR 0009). 15.1 is the consent-disclosure tree referenced from sections
// 5, 8.5, 10.3 and 11: an attachment slot plus three free-text lists. The
// general free-text field has no number on the form, so it is keyed with the
// synthetic ref "15.notes" (same convention as section 12's service keys).
import { TA6_OFFICIAL_FORM_URL, type TA6PromptEntry } from './types';

export const SECTION_15_PROMPTS: TA6PromptEntry[] = [
  {
    ref: '15.1',
    prompt:
      'Attach copies of any consents, permissions or approvals you mentioned in your earlier answers — for example for building work or alterations, an electric vehicle charging point, or heating equipment — or say why each one is not available.',
    helpText:
      'You can attach more than one document. Use the three lists below to record which consents are attached, which will follow, and which are not available.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '15.1.attached',
    prompt: 'List the consents and approvals you are attaching with this form.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '15.1.to-follow',
    prompt: 'List any consents and approvals that you will send on later.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '15.1.not-available',
    prompt:
      'List any consents and approvals you cannot provide, and say why each one is not available.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '15.notes',
    prompt:
      'Is there anything else the buyer should know about the property, or any earlier answer you would like to explain in more detail? Add it here.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
];
