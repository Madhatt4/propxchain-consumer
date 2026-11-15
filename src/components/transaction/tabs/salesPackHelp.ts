// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The "?" help behind each Sales pack row. Wording is verbatim from the
 * mock-up Marc signed off on 2026-11-15 ("no changes, build as drafted"):
 * C:\Users\Admin\Desktop\sales-pack-mockup-2026-11-15.html. Change it there
 * first, with Marc, not here.
 */
import type { PackItemId } from '@/services/salesPackReadiness';

export interface PackRowHelp {
  what: string;
  where: string;
  cost: string;
  who: string;
}

/** The four labelled lines, in the order the panel shows them. */
export const HELP_FIELDS: ReadonlyArray<{ key: keyof PackRowHelp; label: string }> = [
  { key: 'what', label: 'What it is' },
  { key: 'where', label: 'Where you get it' },
  { key: 'cost', label: 'Cost' },
  { key: 'who', label: 'Who usually does it' },
];

export const SALES_PACK_HELP: Record<PackItemId, PackRowHelp> = {
  materialInfo: {
    what: 'The basic facts a buyer must be told up front: price, tenure (freehold or leasehold), property type and council tax band. If it is leasehold, also the years left on the lease, ground rent and service charge.',
    where: 'You know most of it. Council tax band: GOV.UK "Check your Council Tax band" (England and Wales), or your council tax bill. Lease details: your lease or your managing agent.',
    cost: 'Free.',
    who: 'You, or your estate agent if you have one.',
  },
  epc: {
    what: 'A certificate rating how energy-efficient the home is, from A to G. You must have a valid one before you market the property.',
    where: 'We look it up for you on the national EPC register. If none is found, book a Domestic Energy Assessor; GOV.UK "Get a new energy certificate" lists accredited assessors.',
    cost: 'Free if one exists. A new one is usually £60 to £120, paid to the assessor.',
    who: 'Found automatically. If one is needed, you or your agent book it.',
  },
  titlePulled: {
    what: "The official HM Land Registry record of who owns the property, any mortgage on it, and any rights or restrictions. Every buyer's conveyancer checks it first.",
    where: 'We fetch the official copy from HM Land Registry for you in one click.',
    cost: '£7, the HM Land Registry fee. Viewing one you have already pulled is free.',
    who: 'You, here. Otherwise your conveyancer would get it later.',
  },
  ta6: {
    what: 'The standard Law Society questionnaire about the home: boundaries, disputes, alterations, guarantees, services, flooding and more. It is the backbone of the pack.',
    where: 'Fill it in online here, section by section, or upload one you already completed. Gather planning permissions, building-regs certificates and guarantees as you go.',
    cost: 'Free.',
    who: 'You. You know the home; your conveyancer checks it.',
  },
  ta10: {
    what: 'A list of what stays and what goes: carpets, curtains, light fittings, appliances, garden items. It stops arguments on moving day.',
    where: 'Fill it in online here, room by room.',
    cost: 'Free.',
    who: 'You.',
  },
  ta7: {
    what: 'Extra questions for leasehold homes: the lease, the landlord, the managing agent, ground rent and service charges.',
    where: 'Fill it in here. Have your lease and the latest service charge statement to hand.',
    cost: 'Free to fill in. Your managing agent may charge for a separate leasehold pack.',
    who: 'You, with help from your managing agent.',
  },
  searches: {
    what: 'Official checks on the area: local authority (planning, roads), drainage and water, environmental (flooding, contamination), and others where the area needs them, such as coal mining.',
    where: 'Choose them here. We show which ones your area needs; you pick the provider. Results come back into this deal, usually within days, local authority searches can take longer.',
    cost: "Shown before you pay, at the provider's price.",
    who: "You, here. They are your searches and the buyer's conveyancer can rely on them.",
  },
  idShared: {
    what: 'Your conveyancer must check who you are before they can act (anti-money-laundering rules).',
    where: 'Add your ID to your wallet once, then share it with your conveyancer from there. It is never put inside the sales pack the buyer sees.',
    cost: 'Free to share. The identity check itself is priced by the checking provider.',
    who: 'You.',
  },
};
