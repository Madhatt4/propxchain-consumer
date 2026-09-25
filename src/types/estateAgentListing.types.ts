// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import type { PropertyListing, ProvenanceMap } from './listing.types';
import type { MaterialInfo } from './materialInfo.types';

export type AgentListingStatus =
  | 'draft' | 'for_sale' | 'under_offer' | 'sold_stc' | 'exchanged' | 'completed' | 'withdrawn';
export const PUBLIC_STATUSES: readonly AgentListingStatus[] =
  ['for_sale', 'under_offer', 'sold_stc', 'exchanged', 'completed', 'withdrawn'] as const;
export type AgentListingSource = 'rightmove' | 'website' | 'manual';

export interface AgentListingRow {
  id: string;
  organisation_id: string;
  slug: string | null;
  status: AgentListingStatus;
  source: AgentListingSource;
  /** Where the listing was imported FROM (Rightmove/OnTheMarket). Never show
   *  this to a buyer — it points at a competitor portal. */
  source_url: string | null;
  /** The agency's own listing page for this property, agent-entered. */
  agent_url: string | null;
  listing: PropertyListing;
  provenance: ProvenanceMap;
  material_info: MaterialInfo;
  transaction_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}
/** Columns the anon public page may read — never transaction_id. */
export type PublicAgentListing = Pick<AgentListingRow, 'slug' | 'status' | 'listing' | 'material_info' | 'published_at'>;
