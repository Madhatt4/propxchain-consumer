// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { supabase } from '@/lib/supabase';
import { buildPrincipalProof } from '@/services/principalProof';
import type { PrincipalProof } from '@/services/principalProof';
import { generateSlug } from '@/services/sites.service';
import { emptyMaterialInfo } from '@/utils/materialInfo';
import type {
  AgentListingRow,
  AgentListingSource,
  AgentListingStatus,
  PublicAgentListing,
} from '@/types/estateAgentListing.types';
import type { PropertyListing, ProvenanceMap } from '@/types/listing.types';

/** The monorepo-owned edge function; the same string is the proof's domain separator. */
const LINK_LISTING_FN = 'link-listing-transaction';

/** supabase-js throws on non-2xx with a generic message; the machine-readable reason is in the body. */
async function invokeErrorCode(error: {
  message: string;
  context?: { json?: () => Promise<{ error?: string }> };
}): Promise<string> {
  try {
    const body = await error.context?.json?.();
    return body?.error ?? error.message;
  } catch {
    return error.message;
  }
}

/** Input for creating a new estate-agent listing. */
export interface CreateAgentListingInput {
  organisation_id: string;
  source: AgentListingSource;
  source_url: string | null;
  listing: PropertyListing;
  provenance: ProvenanceMap;
}

/** Public listing record, joined with the agency's display details. */
export interface PublicListingRecord extends PublicAgentListing {
  agency_name: string;
  agency_branch: string | null;
}

const NOT_FOUND_CODE = 'PGRST116';

/**
 * Generate a URL-safe slug for a public listing:
 * `${slug(agencyName)}-${slug(postcode)}-${id.slice(0,6)}`.
 */
export function generateListingSlug(agencyName: string, postcode: string, id: string): string {
  return `${generateSlug(agencyName)}-${generateSlug(postcode)}-${id.slice(0, 6)}`;
}

export const estateAgentListingsService = {
  /** List all listings for an organisation, newest first. */
  async listByOrganisation(orgId: string): Promise<AgentListingRow[]> {
    const { data, error } = await supabase
      .from('agent_listings')
      .select('*')
      .eq('organisation_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch listings: ${error.message}`);
    }
    return (data ?? []) as AgentListingRow[];
  },

  /** Fetch a single listing by ID. Returns null when not found. */
  async getById(id: string): Promise<AgentListingRow | null> {
    const { data, error } = await supabase.from('agent_listings').select('*').eq('id', id).single();

    if (error) {
      if (error.code === NOT_FOUND_CODE) return null;
      throw new Error(`Failed to fetch listing: ${error.message}`);
    }
    return data as AgentListingRow;
  },

  /** Create a new listing as a draft with empty material info. */
  async create(input: CreateAgentListingInput): Promise<AgentListingRow> {
    const { data, error } = await supabase
      .from('agent_listings')
      .insert({ ...input, status: 'draft', material_info: emptyMaterialInfo() })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create listing: ${error.message}`);
    }
    return data as AgentListingRow;
  },

  /** Partial-update a listing's editable fields. */
  async update(
    id: string,
    patch: Partial<Pick<AgentListingRow, 'listing' | 'provenance' | 'material_info' | 'source_url' | 'agent_url'>>,
  ): Promise<AgentListingRow> {
    const { data, error } = await supabase.from('agent_listings').update(patch).eq('id', id).select().single();

    if (error) {
      throw new Error(`Failed to update listing: ${error.message}`);
    }
    return data as AgentListingRow;
  },

  /** Set a listing's status directly (e.g. withdraw, mark sold_stc). */
  async setStatus(id: string, status: AgentListingStatus): Promise<void> {
    const { error } = await supabase.from('agent_listings').update({ status }).eq('id', id);

    if (error) {
      throw new Error(`Failed to update listing status: ${error.message}`);
    }
  },

  /**
   * Link a listing to the on-chain transaction created for it.
   *
   * The browser cannot write agent_listings.transaction_id (migration
   * 20260923_agent_listings_transaction_id_server_only.sql): that column is
   * what proves an agent's organisation is on a deal, so a client-written
   * value let any user attach themselves to a stranger's transaction. The
   * monorepo's `link-listing-transaction` edge function writes it instead,
   * after a signed proof that this browser holds the agent's principal and an
   * on-chain check that this principal's start-sale created the deal.
   *
   * Idempotent for the same (listing, deal) — safe on a start-sale resume.
   * A listing or deal already linked elsewhere surfaces as a clean,
   * user-facing message.
   */
  async linkTransaction(id: string, transactionId: string): Promise<void> {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) {
      throw new Error('Failed to link transaction: not signed in');
    }

    let proof: PrincipalProof;
    try {
      proof = await buildPrincipalProof(`${LINK_LISTING_FN}:${id.toLowerCase()}:${transactionId}:${userId}`);
    } catch (err) {
      throw new Error(`Failed to link transaction: ${err instanceof Error ? err.message : 'proof_failed'}`);
    }

    const { data: res, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(LINK_LISTING_FN, {
      body: { listingId: id, transactionId, ...proof },
    });
    const code = error ? await invokeErrorCode(error) : res?.ok ? null : (res?.error ?? 'unexpected_response');
    if (code === null) return;
    if (code === 'listing_already_linked' || code === 'transaction_already_linked') {
      throw new Error('This listing is already linked to a sale.');
    }
    throw new Error(`Failed to link transaction: ${code}`);
  },

  /** Publish a listing: assigns a slug (if unset), stamps published_at, and moves draft -> for_sale. */
  async publish(id: string, agencyName: string): Promise<string> {
    const row = await this.getById(id);
    if (!row) throw new Error('Listing not found');
    const slug = row.slug ?? generateListingSlug(agencyName, row.listing.postcode, row.id);
    const status: AgentListingStatus = row.status === 'draft' ? 'for_sale' : row.status;
    const { error } = await supabase
      .from('agent_listings')
      .update({ slug, status, published_at: row.published_at ?? new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(`Failed to publish listing: ${error.message}`);
    return slug;
  },

  /** Fetch a published listing by slug from the anon-safe public view. */
  async getPublicBySlug(slug: string): Promise<PublicListingRecord | null> {
    const { data, error } = await supabase.from('public_agent_listings').select('*').eq('slug', slug).single();

    if (error) {
      if (error.code === NOT_FOUND_CODE) return null;
      throw new Error(`Failed to fetch public listing: ${error.message}`);
    }
    return data as PublicListingRecord;
  },
};
