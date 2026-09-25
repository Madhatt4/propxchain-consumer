// TA6 6th edition — Section 11 (Services) paraphrased prompts (ADR 0009).
// PropXchain wording only; entries link to the official form for the
// canonical text. Refs mirror packages/core forms_types.mo field names.
import { TA6_OFFICIAL_FORM_URL, type TA6PromptEntry } from './types';

export const SECTION_11_PROMPTS: TA6PromptEntry[] = [
  {
    ref: '11.1',
    prompt:
      'Has any electrical work been carried out at the property — for example rewiring, a new fuse board (consumer unit) or a completely new installation? If yes, say when it was done and what the work was.',
    helpText:
      'Include work done by previous owners if you know about it. If you are not sure, "not known" is an acceptable answer.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '11.2',
    prompt:
      'Do you have certificates or compliance paperwork for electrical work at the property, such as an electrical safety certificate or a Building Regulations completion certificate?',
    helpText: 'If you never received any paperwork, "not known" is an acceptable answer.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '11.2.doc',
    prompt:
      'Attach the electrical certificates or compliance paperwork, or say why they are not available.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '11.3',
    prompt:
      'Has the electrical installation been inspected and reported on — for example with an Electrical Installation Condition Report (EICR)? If yes, give the date of the most recent report.',
    helpText:
      'If you are not sure whether an inspection has ever been done, "not known" is an acceptable answer.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '11.3.doc',
    prompt:
      'Attach the most recent electrical inspection report (EICR), or say why it is not available.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '11.4',
    prompt:
      'What heating and hot water systems does the property have — for example a gas boiler, oil, LPG, electric heating, an air or ground source heat pump, solid fuel, solar thermal or a district heating scheme? For each system, say when it was installed and when it was last serviced.',
    helpText:
      'Add one record per system. Install and last-service dates can be approximate; if you do not know a date, "not known" is an acceptable answer.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '11.4.doc',
    prompt:
      'For each heating system, attach the installation certificate or the most recent service record, or say why it is not available.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '11.5a',
    prompt:
      'Does the foul water from the property — waste from toilets, sinks, baths and appliances — drain into the public sewer?',
    helpText: 'If you are not sure where it drains to, "not known" is an acceptable answer.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '11.5b',
    prompt:
      'Does the surface water from the property — rainwater from roofs, gutters, drives and hard standing — drain into the public sewer?',
    helpText: 'If you are not sure where it drains to, "not known" is an acceptable answer.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '11.6',
    prompt:
      'How does sewage leave the property — through the mains drains, a septic tank, a cesspool, a sewage treatment plant, or another arrangement?',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '11.7',
    prompt:
      'If the property is not on mains drainage, describe the sewerage system: where it is, when it was last emptied or serviced, whether it discharges into the ground or into surface water, whether it has an infiltration (soakaway) system, and whether it complies with the current regulations.',
    helpText:
      'Give the last emptying or service date as a month and year. If you are unsure about any of these details, "not known" is an acceptable answer.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
];
