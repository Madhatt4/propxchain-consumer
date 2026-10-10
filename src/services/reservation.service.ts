// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Reservation saga — multi-step orchestrator for plot reservations.
 * Steps: hold for the buyer → (ICP TODO) → snapshot → hand back the plot's code.
 *
 * The buyer claims the plot by entering its invite code on the Join screen
 * (plotClaim.service). While pending, only the email named here can claim it.
 */

import { supabase } from '@/lib/supabase';
import { plotsService } from '@/services/plots.service';

export interface ReservationInput {
  plotId: string;
  buyerName: string;
  buyerEmail: string;
}

export interface ReservationProgress {
  step: 1 | 2 | 3 | 4;
  status: 'pending' | 'success' | 'failed';
  error?: string;
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

/** Step 1: Hold the plot for this buyer's email, with race protection. */
async function setPending(plotId: string, buyerEmail: string): Promise<void> {
  const { data, error } = await supabase
    .from('plots')
    .update({ reservation_status: 'pending', reserved_for_email: buyerEmail.trim().toLowerCase() })
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

/**
 * Undo step 1 after a later step fails, so the plot doesn't sit in "pending"
 * with no buyer and no way to reserve it again (setPending only moves an
 * "available" plot). Only a still-pending plot is touched.
 */
async function rollbackPending(plotId: string): Promise<void> {
  const { error } = await supabase
    .from('plots')
    .update({ reservation_status: 'available', reserved_for_email: null })
    .eq('id', plotId)
    .eq('reservation_status', 'pending');

  if (error) {
    await recordPlotError(plotId, `Rollback to available failed: ${error.message}`);
  }
}

/**
 * Step 3: Freeze the listing as it stands for this reservation. The server
 * copies it from the plot, plot type, site and developer, and replaces an
 * earlier attempt nobody claimed (migration 20261010_plot_snapshot_per_reservation).
 */
async function createSnapshot(plotId: string): Promise<void> {
  const { error } = await supabase.rpc('snapshot_plot_reservation', { p_plot_id: plotId });

  if (error) {
    throw new Error(`Failed to create snapshot: ${error.message}`);
  }
}

/** Step 4: The code the developer gives the buyer (every plot has one). */
async function getInviteCode(plotId: string): Promise<string> {
  const plot = await plotsService.getById(plotId);
  if (!plot.invite_code) {
    throw new Error('This plot has no invite code');
  }
  return plot.invite_code;
}

/** Release a reservation, returning the plot to available status. */
async function releaseReservationRow(plotId: string): Promise<void> {
  // TODO: Write canister audit event for the release

  // Clear reservation fields on the plot. The plots_rotate_code_on_release
  // trigger issues a fresh invite code, so the old one stops working.
  const { error: plotError } = await supabase
    .from('plots')
    .update({
      reservation_status: 'available',
      reserved_by_buyer_user_id: null,
      reserved_at: null,
      reserved_for_email: null,
    })
    .eq('id', plotId);

  if (plotError) {
    throw new Error(`Failed to release plot: ${plotError.message}`);
  }
}

export const reservationService = {
  /** Release a buyer's reservation, returning the plot to available. */
  async releaseReservation(plotId: string): Promise<void> {
    await releaseReservationRow(plotId);
  },

  /**
   * Run the reservation saga. Calls onProgress after each step.
   * On failure: records last_error on the plot; after step 1 it also returns
   * the plot from pending to available so the developer can retry.
   */
  async reservePlot(
    input: ReservationInput,
    onProgress: (progress: ReservationProgress) => void,
  ): Promise<{ inviteCode: string }> {
    const { plotId, buyerEmail } = input;

    // Step 1: Set pending
    onProgress({ step: 1, status: 'pending' });
    try {
      await setPending(plotId, buyerEmail);
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
      await createSnapshot(plotId);
      onProgress({ step: 3, status: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      onProgress({ step: 3, status: 'failed', error: msg });
      await recordPlotError(plotId, `Step 3 (snapshot): ${msg}`);
      await rollbackPending(plotId);
      throw err;
    }

    // Step 4: The plot's code, for the developer to give the buyer
    onProgress({ step: 4, status: 'pending' });
    try {
      const inviteCode = await getInviteCode(plotId);
      onProgress({ step: 4, status: 'success' });
      return { inviteCode };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      onProgress({ step: 4, status: 'failed', error: msg });
      await recordPlotError(plotId, `Step 4 (invite): ${msg}`);
      await rollbackPending(plotId);
      throw err;
    }
  },
};
