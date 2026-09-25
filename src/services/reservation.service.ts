// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Reservation saga — multi-step orchestrator for plot reservations.
 * Steps: set pending → (ICP TODO) → snapshot → invite token.
 */

import { supabase } from '@/lib/supabase';
import { plotsService, type Plot } from '@/services/plots.service';
import { plotTypesService } from '@/services/plot-types.service';
import { sitesService } from '@/services/sites.service';

export interface ReservationInput {
  plotId: string;
  siteId: string;
  buyerName: string;
  buyerEmail: string;
}

export interface ReservationProgress {
  step: 1 | 2 | 3 | 4;
  status: 'pending' | 'success' | 'failed';
  error?: string;
}

/** Generate a 32-char URL-safe random token. */
function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

/** SHA-256 hash of a string, returned as hex. */
async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Record an error on the plot row for admin visibility. */
async function recordPlotError(
  plotId: string,
  message: string,
): Promise<void> {
  await supabase
    .from('plots')
    .update({ last_error: message })
    .eq('id', plotId);
}

/** Step 1: Set reservation_status to pending with race protection. */
async function setPending(plotId: string): Promise<void> {
  const { data, error } = await supabase
    .from('plots')
    .update({ reservation_status: 'pending' })
    .eq('id', plotId)
    .eq('reservation_status', 'available')
    .select('id');

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }
  if (!data || data.length === 0) {
    throw new Error('Plot is no longer available');
  }
}

/** Step 3: Create a frozen snapshot of the listing. */
async function createSnapshot(
  plot: Plot,
  siteId: string,
): Promise<void> {
  const site = await sitesService.getById(siteId);

  const plotType = plot.plot_type_id
    ? await plotTypesService.getById(plot.plot_type_id)
    : null;

  // TODO: replace placeholder transaction_id with real ICP tx id
  const transactionId = `pending_${plot.id.slice(0, 8)}`;

  const { error } = await supabase
    .from('plot_listing_snapshots')
    .upsert({
      plot_id: plot.id,
      transaction_id: transactionId,
      plot_number: plot.plot_number,
      sale_price_pence: plot.sale_price_pence,
      description_addendum: plot.description_addendum,
      expected_practical_completion: plot.expected_practical_completion,
      plot_specific_image_refs: plot.plot_specific_image_refs,
      features_addendum: plot.features_addendum,
      plot_type_name: plotType?.name ?? null,
      plot_type_description: plotType?.description ?? null,
      plot_type_bedrooms: plotType?.bedrooms ?? null,
      plot_type_bathrooms: plotType?.bathrooms ?? null,
      plot_type_internal_area_sqft: plotType?.internal_area_sqft ?? null,
      plot_type_epc_rating: plotType?.epc_rating ?? null,
      plot_type_floor_plan_image_refs: plotType?.floor_plan_image_refs ?? null,
      plot_type_exterior_image_refs: plotType?.exterior_image_refs ?? null,
      plot_type_interior_image_refs: plotType?.interior_image_refs ?? null,
      plot_type_features: plotType?.features ?? null,
      site_name: site.name,
      site_address: site.address,
      developer_name: null, // TODO: fetch org name once org service exists
    }, { onConflict: 'plot_id' });

  if (error) {
    throw new Error(`Failed to create snapshot: ${error.message}`);
  }
}

/** Step 4: Generate invite token and store hash. */
async function createInviteToken(
  plotId: string,
  buyerEmail: string,
): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    throw new Error('Not authenticated');
  }

  const token = generateToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { error } = await supabase
    .from('invite_codes')
    .insert({
      token_hash: tokenHash,
      plot_id: plotId,
      developer_user_id: userData.user.id,
      buyer_email: buyerEmail,
      expires_at: expiresAt,
    });

  if (error) {
    throw new Error(`Failed to store invite code: ${error.message}`);
  }

  return token;
}

/** Release a reservation, returning the plot to available status. */
async function releaseReservationRow(plotId: string): Promise<void> {
  // TODO: Write canister audit event for the release

  // Clear reservation fields on the plot
  const { error: plotError } = await supabase
    .from('plots')
    .update({
      reservation_status: 'available',
      reserved_by_buyer_user_id: null,
      reserved_at: null,
    })
    .eq('id', plotId);

  if (plotError) {
    throw new Error(`Failed to release plot: ${plotError.message}`);
  }

  // Nullify any related invite codes for this plot
  const { error: inviteError } = await supabase
    .from('invite_codes')
    .update({ revoked_at: new Date().toISOString() })
    .eq('plot_id', plotId)
    .is('revoked_at', null);

  if (inviteError) {
    throw new Error(`Failed to revoke invite codes: ${inviteError.message}`);
  }
}

export const reservationService = {
  /** Release a buyer's reservation, returning the plot to available. */
  async releaseReservation(plotId: string): Promise<void> {
    await releaseReservationRow(plotId);
  },

  /**
   * Run the reservation saga. Calls onProgress after each step.
   * On failure: records last_error on the plot, does not roll back.
   */
  async reservePlot(
    input: ReservationInput,
    onProgress: (progress: ReservationProgress) => void,
  ): Promise<{ inviteToken: string }> {
    const { plotId, siteId, buyerEmail } = input;

    // Step 1: Set pending
    onProgress({ step: 1, status: 'pending' });
    try {
      await setPending(plotId);
      onProgress({ step: 1, status: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      onProgress({ step: 1, status: 'failed', error: msg });
      await recordPlotError(plotId, `Step 1 (pending): ${msg}`);
      throw err;
    }

    // Step 2: ICP transaction (TODO — skip for now)
    onProgress({ step: 2, status: 'pending' });
    // TODO: Create ICP transaction via icp.service.ts
    onProgress({ step: 2, status: 'success' });

    // Step 3: Create snapshot
    onProgress({ step: 3, status: 'pending' });
    try {
      const plot = await plotsService.getById(plotId);
      await createSnapshot(plot, siteId);
      onProgress({ step: 3, status: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      onProgress({ step: 3, status: 'failed', error: msg });
      await recordPlotError(plotId, `Step 3 (snapshot): ${msg}`);
      throw err;
    }

    // Step 4: Generate invite token
    onProgress({ step: 4, status: 'pending' });
    try {
      const inviteToken = await createInviteToken(plotId, buyerEmail);
      onProgress({ step: 4, status: 'success' });
      return { inviteToken };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      onProgress({ step: 4, status: 'failed', error: msg });
      await recordPlotError(plotId, `Step 4 (invite): ${msg}`);
      throw err;
    }
  },
};
