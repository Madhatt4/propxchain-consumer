// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Who can do what on a deal — the single access map for the deal page.
 *
 * Every stage, section and standing card on /transaction/:id/flow looks its
 * level up here instead of deciding for itself. The table is Marc's access
 * matrix of 2026-10-08, row for row. Change a level here and every screen
 * that renders the item follows.
 *
 * This is the page lock only. Hiding a control stops an honest click, not a
 * direct call; the canister and edge functions enforce the same split on
 * their side.
 */

/**
 * Which side of the deal the viewer is on. `other` is anyone on the deal who
 * is neither the seller nor the buyer: an estate agent, a delegate, a bot.
 * The matrix puts them on the seller's side of the work.
 */
export type DealSide = 'seller' | 'buyer' | 'other';

/**
 * act    — can use it.
 * view   — sees all of it, can't change it.
 * status — sees a done / not done line only.
 * hidden — not shown.
 */
export type AccessLevel = 'act' | 'view' | 'status' | 'hidden';

export type DealItem =
  // Seller stages
  | 'salesPack'
  | 'listProperty'
  | 'orderSearches'
  | 'propertyForms'
  | 'buyerProgress'
  // Buyer stages
  | 'propertyMatched'
  | 'mortgage'
  | 'survey'
  | 'reviewPack'
  // Shared stages
  | 'conveyancerQuotes'
  | 'exchange'
  | 'completion'
  // Sections
  | 'property'
  | 'chain'
  | 'wallet'
  | 'buyerPack'
  | 'aiScans'
  | 'aml'
  | 'conveyancerBrief'
  | 'enquiries'
  | 'searches'
  // Standing cards and list actions
  | 'buyerInvite'
  | 'deleteDeal';

type Row = Readonly<Record<DealSide, AccessLevel>>;
const row = (seller: AccessLevel, buyer: AccessLevel, other: AccessLevel): Row => ({ seller, buyer, other });

export const DEAL_ACCESS: Readonly<Record<DealItem, Row>> = {
  salesPack: row('act', 'view', 'act'),
  listProperty: row('act', 'view', 'act'),
  orderSearches: row('act', 'status', 'act'),
  propertyForms: row('act', 'view', 'act'),
  buyerProgress: row('view', 'hidden', 'view'),

  propertyMatched: row('status', 'act', 'status'),
  mortgage: row('status', 'act', 'view'),
  survey: row('status', 'act', 'view'),
  reviewPack: row('status', 'act', 'view'),

  conveyancerQuotes: row('act', 'act', 'view'),
  exchange: row('act', 'act', 'view'),
  completion: row('act', 'act', 'view'),

  property: row('act', 'view', 'view'),
  chain: row('act', 'act', 'view'),
  wallet: row('act', 'act', 'act'),
  buyerPack: row('view', 'act', 'view'),
  aiScans: row('act', 'act', 'view'),
  aml: row('act', 'act', 'act'),
  conveyancerBrief: row('act', 'act', 'view'),
  enquiries: row('view', 'view', 'view'),
  searches: row('view', 'act', 'view'),

  buyerInvite: row('act', 'hidden', 'act'),
  deleteDeal: row('act', 'hidden', 'act'),
};

/** Stage ids from utils/stageConfig.ts, plus the Stage 0 sales pack tab (SALES_PACK_TAB_ID). */
export const STAGE_ITEM: Readonly<Record<string, DealItem>> = {
  'sales-pack-0': 'salesPack',
  'seller-1': 'listProperty',
  'seller-2': 'orderSearches',
  'seller-3': 'propertyForms',
  'seller-4': 'buyerProgress',
  'seller-5': 'conveyancerQuotes',
  'seller-6': 'exchange',
  'seller-7': 'completion',
  'buyer-1': 'propertyMatched',
  'buyer-2': 'mortgage',
  'buyer-3': 'survey',
  'buyer-4': 'reviewPack',
  'buyer-5': 'conveyancerQuotes',
  'buyer-6': 'exchange',
  'buyer-7': 'completion',
};

/** Section ids from components/transaction/tabs/transactionTabs.config.tsx. */
export const SECTION_ITEM: Readonly<Record<string, DealItem>> = {
  property: 'property',
  chain: 'chain',
  wallet: 'wallet',
  'buyer-pack': 'buyerPack',
  'ai-scans': 'aiScans',
  aml: 'aml',
  'conveyancer-brief': 'conveyancerBrief',
  enquiries: 'enquiries',
  searches: 'searches',
};

export function accessFor(item: DealItem, side: DealSide): AccessLevel {
  return DEAL_ACCESS[item][side];
}

export function canAct(item: DealItem, side: DealSide): boolean {
  return accessFor(item, side) === 'act';
}

/**
 * Level for a stage or section id. Ids the map doesn't know (the overview,
 * the seller's "Buyer side" placeholder) carry no lock of their own.
 */
export function accessForId(id: string, side: DealSide): AccessLevel {
  const item = STAGE_ITEM[id] ?? SECTION_ITEM[id];
  return item ? accessFor(item, side) : 'act';
}

/** The principals on each side, as the canister records them. */
export interface DealParties {
  seller: string | null | undefined;
  buyer: string | null | undefined;
  /** Extra principals from the multi-party `sellers` list. */
  sellers?: readonly string[];
  /** Extra principals from the multi-party `buyers` list. */
  buyers?: readonly string[];
}

/**
 * The viewer's side on a deal. Until a buyer joins, the canister stores the
 * seller in the buyer slot as well, so `buyer === seller` means "no buyer".
 */
export function dealSideOf(parties: DealParties, principal: string | null | undefined): DealSide {
  if (!principal) return 'other';
  const { seller, buyer, sellers = [], buyers = [] } = parties;
  if (principal === seller || sellers.includes(principal)) return 'seller';
  const hasBuyer = Boolean(buyer) && buyer !== seller;
  if ((hasBuyer && principal === buyer) || buyers.includes(principal)) return 'buyer';
  return 'other';
}

/** Principals from the canister's optional party list (`[] | [Party[]]`). */
export function principalsOf(
  list: readonly [] | readonly [ReadonlyArray<{ principal: { toString(): string } }>] | undefined | null,
): string[] {
  return (list?.[0] ?? []).map((p) => p.principal.toString());
}
