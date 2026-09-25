// Plain-English help cards for TA6 sections 11–15 (ADR 0009).
// Tone: knowledgeable friend, not a lawyer. These sit alongside the
// per-question paraphrase prompts in ../section11.ts … ../section15.ts
// and must never contradict them.
import type { TA6SectionGuide } from './types';

export const SECTION_GUIDES_11_15: TA6SectionGuide[] = [
  {
    section: 11,
    plainTitle: 'Wiring, heating and drains',
    intro:
      'This section covers the systems that keep the house running: any electrical work done, your heating and hot water, and where the waste water goes. Buyers care because rewiring a house or replacing a boiler costs serious money, and they want to know what has been done and when. If you are not on mains drains, they will also want to know how your septic tank or treatment plant is looked after.',
    whatYoullNeed: [
      'Any electrical paperwork — safety certificates or an inspection report (an EICR, if you have one)',
      'Boiler or heating system installation and service records',
      'The date your septic tank or treatment plant was last emptied or serviced, if you have one',
    ],
    reassurance:
      'If you genuinely do not know something — like work a previous owner did — "not known" is an honest answer and far better than a guess.',
  },
  {
    section: 12,
    plainTitle: 'What the house is connected to',
    intro:
      'A simple checklist of which services actually reach the house: electricity, gas, water, sewerage, phone line and broadband. For each one you say who supplies it and where the meter is, plus where the inside stopcock (the tap that shuts off all the water) is. It saves the buyer hunting for these on moving day.',
    whatYoullNeed: [
      'A recent electricity bill — the supplier name and supply number (MPAN) are printed on it',
      'A recent gas bill — same idea, the supply number there is called the MPRN',
      'A note of where your meters and inside stopcock are',
      'Your phone and broadband provider names, if connected',
    ],
    reassurance:
      'These are simple yes/no facts about your own home, and the meter and supplier details can all be checked against your bills.',
  },
  {
    section: 13,
    plainTitle: 'Your move and who lives there',
    intro:
      'This is about the sale itself: whether you are buying somewhere else at the same time, any dates you must (or cannot) move on, and who lives in the house — including any tenants or lodgers. Buyers care because anyone aged 17 or over living there needs to agree to sign the contract and move out, so the buyer gets the house empty on completion day.',
    whatYoullNeed: [
      'The names and ages of everyone aged 17 or over who lives at the property',
      'A copy of any tenancy or lodger agreement, if someone rents a room',
      'Any dates that would or would not work for your move',
    ],
    reassurance:
      'You know your own household better than anyone — just answer honestly, and ask your conveyancer if you are unsure how an occupier affects the sale.',
  },
  {
    section: 14,
    plainTitle: 'Handing over on moving day',
    intro:
      'The final promises about completion day. You confirm the sale money will clear any mortgage or loan secured on the house, and that you will hand it over empty — you moved out, your belongings and rubbish gone, including from the loft, garage and shed. You also agree to leave behind the manuals and service records so the buyer can work the heating.',
    whatYoullNeed: [
      'A rough idea of what is left to pay on your mortgage or any secured loan',
      'The instruction manuals and service records for your boiler and appliances, gathered in one place',
    ],
    reassurance:
      'If you are not sure the sale price covers everything owed on the property, say so and talk it through with your conveyancer — they deal with this all the time.',
  },
  {
    section: 15,
    plainTitle: 'Paperwork and anything else',
    intro:
      'A catch-all at the end. Attach copies of any consents, permissions or certificates you mentioned earlier — for building work, an electric car charger, heating equipment and so on — and note which are attached, which will follow, and which you cannot find. There is also space to explain any earlier answer that needed more room.',
    whatYoullNeed: [
      'The consents and certificates you referred to in earlier sections',
      'A note of any paperwork you know exists but cannot lay your hands on, and why',
    ],
    reassurance:
      'Missing a document is not a dealbreaker — just say it is not available and why, which is always better than leaving a blank.',
  },
];
