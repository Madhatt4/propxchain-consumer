// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The pricing facts, in one place, for every surface that states them to a
 * person or an agent: /pricing and the WebMCP propxchain_get_pricing tool.
 *
 * Marc's decision (2026-10-15): PropXchain is FREE to use — no plans, no
 * tiers, no platform fee. Only third-party items are paid, per item.
 *
 * Searches are sold with a margin, so nothing here may claim "at cost",
 * "no mark-up" or "pass-through". Conveyancer fees are quote-based: never
 * a fixed £ figure. src/__tests__/pricingClaims.test.ts guards both.
 */

export interface PaidItem {
  label: string;
  /** Display price: a £ figure only where the code charges a fixed amount. */
  cost: string;
  /** Fixed price in GBP, or null when it is priced when ordered or quoted. */
  priceGbp: number | null;
  note: string;
}

export const FREE_FEATURES: readonly string[] = [
  'Your property pack, with the TA6 and TA10 forms',
  'AI reads of your title and search results, in plain English',
  'Enquiry checks before they reach your conveyancer',
  'Document vault and verification',
  'Buyer invite and live progress tracker',
  'On-chain transaction record and audit trail',
  'Conveyancer panel access',
];

export const PAID_ITEMS: readonly PaidItem[] = [
  { label: 'Property searches', cost: 'Per search', priceGbp: null, note: 'Priced when you order' },
  { label: 'ID & AML checks', cost: 'Per check', priceGbp: null, note: 'Priced when you order' },
  {
    label: 'HM Land Registry title',
    cost: '£7',
    priceGbp: 7,
    note: 'Per title pull — names the registered owner',
  },
  { label: 'Property chain check', cost: '£25', priceGbp: 25, note: 'One-off, per transaction' },
  { label: 'Conveyancer', cost: 'Quote', priceGbp: null, note: 'The conveyancer quotes you directly' },
];
