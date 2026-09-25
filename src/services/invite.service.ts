// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Invite token validation and redemption service.
 * Tokens are 32-char URL-safe strings; only SHA-256 hashes are stored in DB.
 */

import { supabase } from '@/lib/supabase';

/** localStorage key for storing a pending invite token across signup/verify flow. */
export const PENDING_INVITE_TOKEN_KEY = 'propxchain_pending_invite_token';

interface InviteRedemptionResult {
  plotId: string;
  siteId: string;
}

interface InviteValidationResult {
  valid: boolean;
  expired: boolean;
  redeemed: boolean;
}

/** SHA-256 hash of a string, returned as hex. Mirrors reservation.service.ts. */
async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const inviteService = {
  /**
   * Validate a token without redeeming it.
   * Returns status flags for display purposes.
   */
  async validateToken(token: string): Promise<InviteValidationResult> {
    const tokenHash = await sha256Hex(token);

    const { data, error } = await supabase
      .from('invite_codes')
      .select('id, expires_at, redeemed_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to validate invite: ${error.message}`);
    }

    if (!data) {
      return { valid: false, expired: false, redeemed: false };
    }

    const isExpired = new Date(data.expires_at) < new Date();
    const isRedeemed = data.redeemed_at !== null;

    return {
      valid: !isExpired && !isRedeemed,
      expired: isExpired,
      redeemed: isRedeemed,
    };
  },

  /**
   * Redeem an invite token.
   * 1. SHA-256 hash the raw token
   * 2. Look up invite_codes WHERE token_hash = hash AND redeemed_at IS NULL AND expires_at > now()
   * 3. If found: set redeemed_at + redeemed_by_user_id, return the plot_id + site_id
   * 4. If not found: throw descriptive error
   */
  async redeemToken(
    token: string,
    userId: string,
  ): Promise<InviteRedemptionResult> {
    const tokenHash = await sha256Hex(token);

    // Find unredeemed, unexpired invite
    const { data: invite, error: lookupError } = await supabase
      .from('invite_codes')
      .select('id, plot_id, expires_at, redeemed_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (lookupError) {
      throw new Error(`Failed to look up invite: ${lookupError.message}`);
    }

    if (!invite) {
      throw new Error('Invalid invite token.');
    }

    if (invite.redeemed_at !== null) {
      throw new Error('This invite has already been redeemed.');
    }

    if (new Date(invite.expires_at) < new Date()) {
      throw new Error(
        'This invite has expired. Please ask the developer to send a new one.',
      );
    }

    // Mark as redeemed
    const { error: updateError } = await supabase
      .from('invite_codes')
      .update({
        redeemed_at: new Date().toISOString(),
        redeemed_by_user_id: userId,
      })
      .eq('id', invite.id)
      .is('redeemed_at', null); // Optimistic lock: only update if still unredeemed

    if (updateError) {
      throw new Error(`Failed to redeem invite: ${updateError.message}`);
    }

    // site_id via plots_public: the plots table is members-only (security scan L1).
    const { data: plot, error: plotError } = await supabase
      .from('plots_public')
      .select('site_id')
      .eq('id', invite.plot_id)
      .single();

    if (plotError || !plot) {
      throw new Error('Invite redeemed but plot data could not be loaded.');
    }

    return {
      plotId: invite.plot_id,
      siteId: plot.site_id as string,
    };
  },
};
