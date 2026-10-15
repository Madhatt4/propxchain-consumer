// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Display-only tier metadata, kept solely because the WebMCP pricing tool
 * (src/lib/webmcp.ts) still reads it. Nothing in the app gates on a tier any
 * more: the platform launched free on 2026-10-15 and the gating plumbing was
 * deleted. Remove this file once the pricing copy stops importing it.
 */

export type SubscriptionTier = 'starter' | 'premium';

export interface TierMetadata {
  name: string;
  displayName: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  transactionLimit: number | null; // null = unlimited
  userLimit: number | null; // null = unlimited
  color: string;
  order: number; // For tier comparison (higher = better)
}

export const TIER_METADATA: Record<SubscriptionTier, TierMetadata> = {
  starter: {
    name: 'starter',
    displayName: 'Starter',
    description: 'Free platform access — you only pay HMLR title and search fees on demand',
    monthlyPrice: 0,
    annualPrice: 0,
    transactionLimit: null,
    userLimit: 1,
    color: '#059669',
    order: 0
  },
  premium: {
    name: 'premium',
    displayName: 'Premium',
    description: '£75 per transaction — full platform features',
    monthlyPrice: 75,
    annualPrice: 75, // Per transaction
    transactionLimit: null,
    userLimit: null,
    color: '#0D9488',
    order: 1
  }
};
