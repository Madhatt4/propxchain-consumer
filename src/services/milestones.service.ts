// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { supabase } from '@/lib/supabase';

/** Allowed milestone category values matching the DB constraint. */
export type MilestoneType =
  | 'foundation'
  | 'roof_on'
  | 'practical_completion'
  | 'nhbc_signoff'
  | 'custom';

/** Row shape returned by Supabase for the build_milestones table. */
export interface BuildMilestone {
  id: string;
  site_id: string;
  plot_id: string | null;
  milestone_type: MilestoneType | null;
  custom_label: string | null;
  expected_date: string | null;
  actual_date: string | null;
  notes: string | null;
  created_by_user_id: string | null;
  created_at: string;
}

/** Input for creating a new milestone. */
export interface CreateMilestoneInput {
  site_id: string;
  plot_id?: string | null;
  milestone_type: MilestoneType;
  custom_label?: string | null;
  expected_date: string;
  notes?: string | null;
}

/** Input for updating an existing milestone. */
export interface UpdateMilestoneInput {
  milestone_type?: MilestoneType;
  custom_label?: string | null;
  expected_date?: string;
  actual_date?: string | null;
  notes?: string | null;
  plot_id?: string | null;
}

export const milestonesService = {
  /** Create a new build milestone. */
  async create(input: CreateMilestoneInput): Promise<BuildMilestone> {
    const { data, error } = await supabase
      .from('build_milestones')
      .insert(input)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create milestone: ${error.message}`);
    }
    return data as BuildMilestone;
  },

  /** Fetch all milestones for a site (including plot-specific ones). */
  async getBySite(siteId: string): Promise<BuildMilestone[]> {
    const { data, error } = await supabase
      .from('build_milestones')
      .select('*')
      .eq('site_id', siteId)
      .order('expected_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch milestones: ${error.message}`);
    }
    return (data ?? []) as BuildMilestone[];
  },

  /** Fetch milestones for a specific plot. */
  async getByPlot(plotId: string): Promise<BuildMilestone[]> {
    const { data, error } = await supabase
      .from('build_milestones')
      .select('*')
      .eq('plot_id', plotId)
      .order('expected_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch plot milestones: ${error.message}`);
    }
    return (data ?? []) as BuildMilestone[];
  },

  /** Update an existing milestone. */
  async update(id: string, input: UpdateMilestoneInput): Promise<BuildMilestone> {
    const { data, error } = await supabase
      .from('build_milestones')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update milestone: ${error.message}`);
    }
    return data as BuildMilestone;
  },

  /** Mark a milestone as complete by setting actual_date to today. */
  async markComplete(id: string): Promise<BuildMilestone> {
    const today = new Date().toISOString().split('T')[0];
    return milestonesService.update(id, { actual_date: today });
  },

  /** Delete a milestone. */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('build_milestones')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete milestone: ${error.message}`);
    }
  },
};
