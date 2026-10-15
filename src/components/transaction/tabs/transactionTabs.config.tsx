// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2025 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * Transaction dashboard tab registry — the single place to add a tab.
 *
 * To add a new data source as a tab: append an entry with its `Component`.
 * The shell handles the tab bar and deep-linking (?tab=). Every section is
 * open to every user: the platform is free (2026-10-15), so there is no tier.
 */
import type { ComponentType } from 'react';
import { LayoutDashboard, MapPin, Link2, Wallet, Sparkles, ShieldCheck, Mail, MessageSquare, ClipboardCheck, FileSearch } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ChainTab } from './ChainTab';
import { PropertyTab } from './PropertyTab';
import { TransactionWalletTab } from './TransactionWalletTab';
import { AiScansTab } from './AiScansTab';
import { AmlPanelTab } from './AmlPanelTab';
import { ConveyancerBriefTab } from './ConveyancerBriefTab';
import { EnquiriesTab } from './EnquiriesTab';
import { BuyerPackTab } from './BuyerPackTab';
import { SearchesTab } from './SearchesTab';

/** Data passed to every tab component. */
export interface TransactionTabContext {
  transactionId: string;
  uprn?: string;
  postcode?: string;
  propertyAddress?: string;
}

/** Props a tab component receives — context plus its access level. */
export interface TransactionTabProps extends TransactionTabContext {
  /**
   * True when the viewer may see this section but not change it
   * (lib/dealAccess level `view`). Sections that gate their own controls by
   * the viewer's party role read it; the shell frames the rest.
   */
  readOnly?: boolean;
}

export interface TransactionTabDef {
  id: string;
  label: string;
  icon: LucideIcon;
  /**
   * 'overview' renders the page's existing body (passed to the shell as
   * `overview`); 'component' renders `Component`.
   */
  kind: 'overview' | 'component';
  Component?: ComponentType<TransactionTabProps>;
}

export const TRANSACTION_TABS: TransactionTabDef[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, kind: 'overview' },
  // Sales pack lives as Stage 0 in the flow, not a drawer section — see
  // SALES_PACK_TAB_ID in flow/StageTabs (amended decision on issue #115).
  { id: 'property', label: 'Property', icon: MapPin, kind: 'component', Component: PropertyTab },
  { id: 'chain', label: 'Chain', icon: Link2, kind: 'component', Component: ChainTab },
  { id: 'wallet', label: 'Transaction Wallet', icon: Wallet, kind: 'component', Component: TransactionWalletTab },
  // Buyer Pack (monorepo spec 2026-09-05): the buyer-side mirror of the Sales
  // Pack. Free — the buyer never pays. The buyer assembles it; every other
  // joined party sees the read-only status (server-gated via buyer_pack_status).
  { id: 'buyer-pack', label: 'Buyer Pack', icon: ClipboardCheck, kind: 'component', Component: BuyerPackTab },
  { id: 'ai-scans', label: 'AI Scans', icon: Sparkles, kind: 'component', Component: AiScansTab },
  // Per-person checks, reached from the header button beside Transaction
  // Wallet. A tab not a flow stage — checks must not gate the deal.
  { id: 'aml', label: 'ID & AML', icon: ShieldCheck, kind: 'component', Component: AmlPanelTab },
  // Gated on an accepted conveyancer quote (server-side 403 when there is
  // none), not on who the user is.
  { id: 'conveyancer-brief', label: 'Conveyancer Brief', icon: Mail, kind: 'component', Component: ConveyancerBriefTab },
  // Structured pre-contract enquiries (monorepo spec 2026-09-04).
  { id: 'enquiries', label: 'Enquiries', icon: MessageSquare, kind: 'component', Component: EnquiriesTab },
  // The deal's search orders, which are back, and the buyer-side sign-off
  // (review M23, 2026-09-27). Readable by every party; signing is server-gated.
  { id: 'searches', label: 'Searches', icon: FileSearch, kind: 'component', Component: SearchesTab },
];
