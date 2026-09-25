// TA6 6th edition — Section 13 (Transaction information) paraphrased prompts
// (ADR 0009). 13.1/13.2/13.3/13.5/13.6 are yes/no only on the form, so no
// "not known" guidance is offered for those. Refs mirror forms_types.mo.
import { TA6_OFFICIAL_FORM_URL, type TA6PromptEntry } from './types';

export const SECTION_13_PROMPTS: TA6PromptEntry[] = [
  {
    ref: '13.1',
    prompt:
      'Does your sale depend on you buying another property at the same time? If yes, give details, including how far along that purchase is.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '13.2',
    prompt:
      'Do you have any special requirements about the moving date — for example a date you need to complete by, or dates that would not work for you? If yes, give details.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '13.3',
    prompt: 'Do you live at the property?',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '13.4',
    prompt:
      'Apart from you, does anyone aged 17 or over live at the property? If yes, give their full names.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '13.4b',
    prompt: 'Are any of the people living at the property tenants or lodgers?',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '13.5',
    prompt:
      'Will the buyer get vacant possession when the sale completes — the property handed over empty of occupiers, cleared of rubbish, and with any contents not included in the sale removed?',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '13.6',
    prompt:
      'Has every occupier aged 17 or over agreed both to sign the sale contract and to move out before completion?',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '13.7',
    prompt:
      'For each occupier who is not a seller, give their full name and age.',
    helpText: 'Add one record per occupier. Only needed when other people live at the property.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '13.7.doc',
    prompt:
      'For any occupier who is a tenant or lodger, attach a copy of their tenancy agreement or written arrangement, or say why it is not available.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
];
