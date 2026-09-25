// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2025 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * Transaction dashboard tab registry — the single place to add a tab.
 *
 * To add a new data source as a tab: append an entry with its `minTier`
 * (Starter / Premium / Enterprise) and `Component`. The shell handles the
 * tab bar, deep-linking (?tab=), and locked-tab teasers automatically.
 */
import type { ComponentType } from 'react';
import { LayoutDashboard, MapPin, Link2, Wallet, Sparkles, ShieldCheck, Mail, MessageSquare, ClipboardCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SubscriptionTier } from '@/constants/subscriptionFeatures';
import { ChainTab } from './ChainTab';
import { PropertyTab } from './PropertyTab';
import { TransactionWalletTab } from './TransactionWalletTab';
import { AiScansTab } from './AiScansTab';
import { AmlPanelTab } from './AmlPanelTab';
import { ConveyancerBriefTab } from './ConveyancerBriefTab';
import { EnquiriesTab } from './EnquiriesTab';
import { BuyerPackTab } from './BuyerPackTab';

/** Data passed to every tab component. */
export interface TransactionTabContext {
  transactionId: string;
  uprn?: string;
  postcode?: string;
  propertyAddress?: string;
}

/** Props a tab component receives — context plus its locked state. */
export interface TransactionTabProps extends TransactionTabContext {
  /** True when the user's tier is below this tab's minTier (show a teaser). */
  locked: boolean;
  requiredTier: SubscriptionTier;
}

export interface TransactionTabDef {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Lowest tier that fully unlocks this tab. */
  minTier: SubscriptionTier;
  /**
   * 'overview' renders the page's existing body (passed to the shell as
   * `overview`); 'component' renders `Component`.
   */
  kind: 'overview' | 'component';
  Component?: ComponentType<TransactionTabProps>;
}

export const TRANSACTION_TABS: TransactionTabDef[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, minTier: 'starter', kind: 'overview' },
  // Sales pack lives as Stage 0 in the flow, not a drawer section — see
  // SALES_PACK_TAB_ID in flow/StageTabs (amended decision on issue #115).
  { id: 'property', label: 'Property', icon: MapPin, minTier: 'starter', kind: 'component', Component: PropertyTab },
  { id: 'chain', label: 'Chain', icon: Link2, minTier: 'starter', kind: 'component', Component: ChainTab }, // Unlocked to all tiers (was premium-gated, card d6cc2aee)
  { id: 'wallet', label: 'Transaction Wallet', icon: Wallet, minTier: 'starter', kind: 'component', Component: TransactionWalletTab },
  // Buyer Pack (monorepo spec 2026-09-05): the buyer-side mirror of the Sales
  // Pack. Free — the buyer never pays. The buyer assembles it; every other
  // joined party sees the read-only status (server-gated via buyer_pack_status).
  { id: 'buyer-pack', label: 'Buyer Pack', icon: ClipboardCheck, minTier: 'starter', kind: 'component', Component: BuyerPackTab },
  { id: 'ai-scans', label: 'AI Scans', icon: Sparkles, minTier: 'starter', kind: 'component', Component: AiScansTab }, // Free now; gate later (card f9b06c85 / c6f106c4)
  // Per-person checks, reached from the header button beside Transaction
  // Wallet. A tab not a flow stage — checks must not gate the deal.
  { id: 'aml', label: 'ID & AML', icon: ShieldCheck, minTier: 'starter', kind: 'component', Component: AmlPanelTab },
  // Available to all tiers — gated instead on an accepted conveyancer quote
  // (server-side 403 when there is none), same free-but-conditionally-gated
  // shape as ai-scans/aml above.
  { id: 'conveyancer-brief', label: 'Conveyancer Brief', icon: Mail, minTier: 'starter', kind: 'component', Component: ConveyancerBriefTab },
  // Structured pre-contract enquiries (monorepo spec 2026-09-04). Starter: the
  // loop is the pack's value; the AI pack check inside it is Premium (402 → note).
  { id: 'enquiries', label: 'Enquiries', icon: MessageSquare, minTier: 'starter', kind: 'component', Component: EnquiriesTab },
  // ＋ future: searches detail — add an entry here.
];

/** The one unlock rule for a section: starter sections are always open; premium ones need the premium tier. */
export function isTabUnlocked(minTier: SubscriptionTier, isPremium: boolean): boolean {
  return minTier === 'starter' || (minTier === 'premium' && isPremium);
}
