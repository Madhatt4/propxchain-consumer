// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { supabase } from '@/lib/supabase';

/** File reference stored in JSONB image arrays. */
export interface ImageRef {
  name: string;
  size: number;
  uploadedAt: string;
}

/** Row shape returned by Supabase for the plot_types table. */
export interface PlotType {
  id: string;
  site_id: string;
  name: string;
  description: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  internal_area_sqft: number | null;
  base_price_pence: number | null;
  epc_rating: string | null;
  floor_plan_image_refs: ImageRef[];
  exterior_image_refs: ImageRef[];
  interior_image_refs: ImageRef[];
  features: string[];
  created_at: string;
  updated_at: string;
}

/** Input for creating a new plot type. */
export interface CreatePlotTypeInput {
  site_id: string;
  name: string;
  description?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  internal_area_sqft?: number | null;
  base_price_pence?: number | null;
  epc_rating?: string | null;
  floor_plan_image_refs?: ImageRef[];
  exterior_image_refs?: ImageRef[];
  interior_image_refs?: ImageRef[];
  features?: string[];
}

/** Input for updating an existing plot type. */
export type UpdatePlotTypeInput = Partial<Omit<CreatePlotTypeInput, 'site_id'>>;

export const plotTypesService = {
  /** Create a new plot type. RLS enforces org membership via site. */
  async create(input: CreatePlotTypeInput): Promise<PlotType> {
    const { data, error } = await supabase
      .from('plot_types')
      .insert(input)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create plot type: ${error.message}`);
    }
    return data as PlotType;
  },

  /** Fetch a single plot type by ID. RLS enforces org membership. */
  async getById(id: string): Promise<PlotType> {
    const { data, error } = await supabase
      .from('plot_types')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch plot type: ${error.message}`);
    }
    return data as PlotType;
  },

  /** List all plot types for a site. */
  async getBySite(siteId: string): Promise<PlotType[]> {
    const { data, error } = await supabase
      .from('plot_types')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch plot types: ${error.message}`);
    }
    return (data ?? []) as PlotType[];
  },

  /** Update an existing plot type. RLS enforces org membership. */
  async update(id: string, input: UpdatePlotTypeInput): Promise<PlotType> {
    const { data, error } = await supabase
      .from('plot_types')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update plot type: ${error.message}`);
    }
    return data as PlotType;
  },

  /** Delete a plot type. RLS enforces org membership. */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('plot_types')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete plot type: ${error.message}`);
    }
  },
};
