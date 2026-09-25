// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { supabase } from '@/lib/supabase';

/** Row shape returned by Supabase for the development_sites table. */
export interface DevelopmentSite {
  id: string;
  organisation_id: string;
  name: string;
  slug: string | null;
  address: string;
  postcode: string;
  total_plots: number;
  appointed_solicitor_firm: string | null;
  appointed_solicitor_contact: string | null;
  appointed_solicitor_email: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

/** Input for creating a new development site. */
export interface CreateSiteInput {
  organisation_id: string;
  name: string;
  slug: string;
  address: string;
  postcode: string;
  total_plots: number;
  appointed_solicitor_firm?: string | null;
  appointed_solicitor_contact?: string | null;
  appointed_solicitor_email?: string | null;
}

/**
 * Generate a URL-safe slug from a site name.
 * Lowercase, non-alphanumeric replaced with hyphens, collapsed, trimmed.
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

export const sitesService = {
  /** Create a new development site. RLS enforces org membership. */
  async create(site: CreateSiteInput): Promise<DevelopmentSite> {
    const { data, error } = await supabase
      .from('development_sites')
      .insert(site)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create site: ${error.message}`);
    }
    return data as DevelopmentSite;
  },

  /** Fetch a single site by ID. RLS enforces org membership. */
  async getById(siteId: string): Promise<DevelopmentSite> {
    const { data, error } = await supabase
      .from('development_sites')
      .select('*')
      .eq('id', siteId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch site: ${error.message}`);
    }
    return data as DevelopmentSite;
  },

  /** List all sites for an organisation. */
  async getByOrganisation(orgId: string): Promise<DevelopmentSite[]> {
    const { data, error } = await supabase
      .from('development_sites')
      .select('*')
      .eq('organisation_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch sites: ${error.message}`);
    }
    return (data ?? []) as DevelopmentSite[];
  },

  /** Partial-update a site. RLS enforces org membership. */
  async update(
    siteId: string,
    fields: Partial<Omit<DevelopmentSite, 'id' | 'created_at' | 'updated_at' | 'organisation_id'>>,
  ): Promise<DevelopmentSite> {
    const { data, error } = await supabase
      .from('development_sites')
      .update(fields)
      .eq('id', siteId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update site: ${error.message}`);
    }
    return data as DevelopmentSite;
  },

  /** Check whether a slug is available (not taken by another site). */
  async checkSlugAvailable(slug: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('development_sites')
      .select('id', { count: 'exact', head: true })
      .eq('slug', slug);

    if (error) {
      throw new Error(`Slug check failed: ${error.message}`);
    }
    return (count ?? 0) === 0;
  },
};
