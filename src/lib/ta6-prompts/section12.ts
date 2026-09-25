// TA6 6th edition — Section 12 (Connection to services) paraphrased prompts
// (ADR 0009). Section 12 is a yes/no grid of service rows with detail fields,
// so refs are synthetic "12.<service>" keys (no numbered sub-questions on the
// form). Answers here are yes/no on the form — "not known" is not offered.
import { TA6_OFFICIAL_FORM_URL, type TA6PromptEntry } from './types';

export const SECTION_12_PROMPTS: TA6PromptEntry[] = [
  {
    ref: '12.electricity',
    prompt:
      'Is the property connected to mains electricity? If yes, name the supplier and say where the meter is.',
    helpText:
      'Detail fields: provider, meter location and supply number — the MPAN, which is printed on your electricity bill.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '12.gas',
    prompt:
      'Is the property connected to mains gas? If yes, name the supplier and say where the meter is.',
    helpText:
      'Detail fields: provider, meter location and supply number — the MPRN, which is printed on your gas bill.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '12.water',
    prompt:
      'Is the property connected to mains water? If yes, name the supplier and say where the inside stopcock and any water meter are.',
    helpText: 'Detail fields: provider, stopcock location and meter location.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '12.sewerage',
    prompt:
      'Is the property connected to mains sewerage (the public sewer)? If yes, name the provider.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '12.treatment-plant',
    prompt:
      'Does the property have a small sewage treatment plant? If yes, give its make and model and say who supplied it and who services it.',
    helpText: 'Detail fields: provider, make and model, and the maintenance company.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '12.heat-pumps',
    prompt:
      'Does the property use shared heat pumps? If yes, give the make and model and say who supplied them and who services them.',
    helpText: 'Detail fields: provider, make and model, and the maintenance company.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '12.telephone',
    prompt: 'Is the property connected to a telephone landline? If yes, name the provider.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '12.broadband',
    prompt: 'Is the property connected to broadband? If yes, name the provider.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '12.other',
    prompt:
      'Are any other services connected to the property — for example oil, LPG or a communal energy scheme? List them here.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
];
