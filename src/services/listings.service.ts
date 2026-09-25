// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Publish / unpublish logic for plot listings.
 */

import { supabase } from '@/lib/supabase';

/** Generate a URL-safe listing slug from site slug + plot number. */
function generateListingSlug(siteSlug: string, plotNumber: string): string {
  return `${siteSlug}-${plotNumber}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Generate a TX-XXXX-XXXX invite code. */
function generateInviteCode(): string {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I, O to avoid confusion
  let block1 = '';
  let block2 = '';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 4; i++) {
    block1 += chars[bytes[i] % chars.length];
    block2 += chars[bytes[i + 4] % chars.length];
  }
  return `TX-${block1}-${block2}`;
}

export const listingsService = {
  /**
   * Publish a plot listing.
   * 1. Generate a listing slug if not already set (from site slug + plot number).
   * 2. Generate a TX-XXXX-XXXX invite code for buyer onboarding.
   * 3. Update plots row: listing_status='published', listing_first_published_at=now().
   */
  async publishPlot(
    plotId: string,
    siteSlug: string,
    plotNumber: string,
  ): Promise<void> {
    const slug = generateListingSlug(siteSlug, plotNumber);
    const inviteCode = generateInviteCode();

    const { error } = await supabase
      .from('plots')
      .update({
        listing_status: 'published',
        listing_slug: slug,
        listing_first_published_at: new Date().toISOString(),
        invite_code: inviteCode,
      })
      .eq('id', plotId);

    if (error) {
      throw new Error(`Failed to publish plot: ${error.message}`);
    }
  },

  /**
   * Unpublish (withdraw) a plot listing.
   * Sets listing_status back to 'draft'.
   * The slug, first_published_at, and invite_code are preserved for audit purposes.
   */
  async unpublishPlot(plotId: string): Promise<void> {
    const { error } = await supabase
      .from('plots')
      .update({ listing_status: 'draft' })
      .eq('id', plotId);

    if (error) {
      throw new Error(`Failed to unpublish plot: ${error.message}`);
    }
  },
};
