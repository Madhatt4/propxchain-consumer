// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The roles offered on the first registration screen. Seller and buyer carry
 * on to the account form; the other three go to their own registration door
 * (agency / firm / company details first), so each keeps the checks it
 * already has.
 */

export type RegistrationRole = 'seller' | 'buyer' | 'estate-agent' | 'conveyancer' | 'developer';

export interface RoleCardConfig {
  role: RegistrationRole;
  title: string;
  description: string;
  /** Where the card goes. `form` stays on /register; a path leaves it. */
  destination: 'form' | string;
}

export const ROLE_PRICE_COPY = 'Free, no platform fee';

export const ROLE_CARDS: readonly RoleCardConfig[] = [
  {
    role: 'seller',
    title: "I'm selling",
    description: 'List your property for sale and invite your buyer.',
    destination: 'form',
  },
  {
    role: 'buyer',
    title: "I'm buying",
    description: 'Join an existing transaction with an invite code.',
    destination: 'form',
  },
  {
    role: 'estate-agent',
    title: "I'm an estate agent",
    description: 'Run your sales on PropXchain and steer each sale for your seller.',
    destination: '/register/estate-agent',
  },
  {
    role: 'conveyancer',
    title: "I'm a conveyancer",
    description: 'Take on matters when a client chooses you.',
    destination: '/register/conveyancer',
  },
  {
    role: 'developer',
    title: "I'm a developer",
    description: 'Sell new-build plots through one pipeline.',
    destination: '/register/developer',
  },
];

/** Label shown on the account form once a card has been chosen. */
export const REGISTRATION_ROLE_LABEL: Record<'seller' | 'buyer' | 'solicitor', string> = {
  seller: 'a property seller',
  buyer: 'a property buyer',
  solicitor: 'a conveyancer / solicitor',
};
