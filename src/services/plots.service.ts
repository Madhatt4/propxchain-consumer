// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { supabase } from '@/lib/supabase';

/** Row shape returned by Supabase for the plots table. */
export interface Plot {
  id: string;
  site_id: string;
  plot_type_id: string | null;
  plot_number: string;
  sale_price_pence: number | null;
  description_addendum: string | null;
  plot_specific_image_refs: unknown[];
  features_addendum: string[];
  expected_practical_completion: string | null;
  listing_status: string;
  listing_slug: string | null;
  listing_first_published_at: string | null;
  reservation_status: string;
  reserved_by_buyer_user_id: string | null;
  reserved_at: string | null;
  transaction_id: string | null;
  current_build_status: string | null;
  current_legal_status: string | null;
  at_risk_flag: boolean;
  at_risk_reason: string | null;
  invite_code: string | null;
  last_error: string | null;
  email_failed: boolean;
  created_at: string;
  updated_at: string;
}

/** Input for creating a new plot. */
export interface CreatePlotInput {
  site_id: string;
  plot_type_id?: string | null;
  plot_number: string;
  sale_price_pence?: number | null;
  description_addendum?: string | null;
  features_addendum?: string[];
  expected_practical_completion?: string | null;
}

/** Input for updating an existing plot. */
export type UpdatePlotInput = Partial<Omit<CreatePlotInput, 'site_id'>> & {
  at_risk_flag?: boolean;
  at_risk_reason?: string | null;
};

export const plotsService = {
  /** Create a new plot. RLS enforces org membership via site. */
  async create(input: CreatePlotInput): Promise<Plot> {
    const { data, error } = await supabase
      .from('plots')
      .insert(input)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create plot: ${error.message}`);
    }
    return data as Plot;
  },

  /**
   * Insert many plots in a single round-trip. RLS enforces org membership via site.
   * Returns the inserted IDs paired with plot_number so callers can drive a publish loop.
   * Throws on ANY constraint violation — Supabase rejects the whole batch.
   */
  async bulkCreate(
    inputs: CreatePlotInput[],
  ): Promise<{ id: string; plot_number: string }[]> {
    if (inputs.length === 0) return [];

    const { data, error } = await supabase
      .from('plots')
      .insert(inputs)
      .select('id, plot_number');

    if (error) {
      throw new Error(`Failed to bulk-create plots: ${error.message}`);
    }
    return (data ?? []) as { id: string; plot_number: string }[];
  },

  /** Fetch a single plot by ID. RLS enforces org membership. */
  async getById(id: string): Promise<Plot> {
    const { data, error } = await supabase
      .from('plots')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch plot: ${error.message}`);
    }
    return data as Plot;
  },

  /** List all plots for a site. */
  async getBySite(siteId: string): Promise<Plot[]> {
    const { data, error } = await supabase
      .from('plots')
      .select('*')
      .eq('site_id', siteId)
      .order('plot_number', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch plots: ${error.message}`);
    }
    return (data ?? []) as Plot[];
  },

  /** Update an existing plot. RLS enforces org membership. */
  async update(id: string, input: UpdatePlotInput): Promise<Plot> {
    const { data, error } = await supabase
      .from('plots')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update plot: ${error.message}`);
    }
    return data as Plot;
  },

  /** Delete a plot. RLS enforces org membership. */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('plots')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete plot: ${error.message}`);
    }
  },

  /**
   * Record a material edit to the plot_listing_edits audit table.
   * The `fieldsChanged` JSONB uses versioned shape per migration convention.
   */
  async recordMaterialEdit(
    plotId: string,
    userId: string,
    changedFields: string[],
    previousValues: Record<string, unknown>,
    newValues: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await supabase
      .from('plot_listing_edits')
      .insert({
        plot_id: plotId,
        edited_by_user_id: userId,
        edit_type: 'material',
        edit_summary: `Changed: ${changedFields.join(', ')}`,
        fields_changed: {
          schema_version: 1,
          changes: Object.fromEntries(
            changedFields.map((field) => [
              field,
              { previous: previousValues[field], new: newValues[field] },
            ]),
          ),
        },
      });

    if (error) {
      throw new Error(`Failed to record material edit: ${error.message}`);
    }
  },

  /** Count plots for a site. */
  async countBySite(siteId: string): Promise<number> {
    const { count, error } = await supabase
      .from('plots')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId);

    if (error) {
      throw new Error(`Failed to count plots: ${error.message}`);
    }
    return count ?? 0;
  },
};
