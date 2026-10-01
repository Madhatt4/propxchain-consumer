// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { House, KeyRound, Signpost, Scale, HardHat, type LucideIcon } from 'lucide-react';

/**
 * The roles offered on the first registration screen. Seller and buyer sit on
 * one row and carry on to the account form; the three professions sit under
 * them and go to their own registration door (agency / firm / company details
 * first), so each keeps the checks it already has.
 */

export type RegistrationRole = 'seller' | 'buyer' | 'estate-agent' | 'conveyancer' | 'developer';

export interface RoleCardConfig {
  role: RegistrationRole;
  group: 'people' | 'professionals';
  title: string;
  description: string;
  /** Where the card goes. `form` stays on /register; a path leaves it. */
  destination: 'form' | string;
  icon: LucideIcon;
  /** Tailwind classes: tinted icon chip, and the coloured top edge of the card. */
  chipClass: string;
  edgeClass: string;
}

export const ROLE_PRICE_COPY = 'Free, no platform fee';
export const PROFESSIONALS_HEADING = 'For professionals';

export const ROLE_CARDS: readonly RoleCardConfig[] = [
  {
    role: 'seller',
    group: 'people',
    title: "I'm selling",
    description: 'List your property and invite your buyer.',
    destination: 'form',
    icon: House,
    chipClass: 'bg-[#CCFBF1] text-[#0F766E]',
    edgeClass: 'border-t-[#0D9488]',
  },
  {
    role: 'buyer',
    group: 'people',
    title: "I'm buying",
    description: 'Join a transaction with an invite code.',
    destination: 'form',
    icon: KeyRound,
    chipClass: 'bg-[#DCE8F5] text-[#1E3A5F]',
    edgeClass: 'border-t-[#1E3A5F]',
  },
  {
    role: 'estate-agent',
    group: 'professionals',
    title: "I'm an estate agent",
    description: 'Run your sales on PropXchain and steer each sale for your seller.',
    destination: '/register/estate-agent',
    icon: Signpost,
    chipClass: 'bg-[#FDEBD0] text-[#9A5B00]',
    edgeClass: 'border-t-[#D9822B]',
  },
  {
    role: 'conveyancer',
    group: 'professionals',
    title: "I'm a conveyancer",
    description: 'Take on matters when a client chooses you.',
    destination: '/register/conveyancer',
    icon: Scale,
    chipClass: 'bg-[#E6E1F5] text-[#4B3F8F]',
    edgeClass: 'border-t-[#6A5ACD]',
  },
  {
    role: 'developer',
    group: 'professionals',
    title: "I'm a developer",
    description: 'Sell new-build plots through one pipeline.',
    destination: '/register/developer',
    icon: HardHat,
    chipClass: 'bg-[#DDEBDD] text-[#2F6B3A]',
    edgeClass: 'border-t-[#5F8A68]',
  },
];

/** Label shown on the account form once a card has been chosen. */
export const REGISTRATION_ROLE_LABEL: Record<'seller' | 'buyer' | 'solicitor', string> = {
  seller: 'a property seller',
  buyer: 'a property buyer',
  solicitor: 'a conveyancer / solicitor',
};
