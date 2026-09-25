// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Subscription Tier Definitions
 *
 * Canonical tier scheme (locked 2026-05-17, card d662d062):
 *   starter    — FREE platform access. Pay HMLR/search fees on demand.
 *   premium    — £75 per transaction. Full platform features
 *                (incl. multi-user, analytics, bulk, audit logs).
 *
 * 'hmlr-pull' is a £7 per-use addon, not a tier — handled by the
 * payment-worker price table directly, not the subscription tier system.
 */

export type SubscriptionTier = 'starter' | 'premium';

export type SubscriptionFeature =
  | 'analytics'                 // Premium+
  | 'advanced_documents'        // Premium+
  | 'bulk_transactions'         // Premium+
  | 'priority_support'          // Premium+
  | 'multi_user'                // Premium+
  | 'blockchain_ledger'         // Premium+
  | 'advanced_reporting'        // Premium+
  | 'audit_logs'                // Premium+
  | 'next_step_recommendations'; // All tiers (incl. starter)

/**
 * Feature access mapping for each tier
 */
export const TIER_FEATURES: Record<SubscriptionTier, SubscriptionFeature[]> = {
  // 2026-08-21, Marc: everything is free at launch. Starter therefore holds the
  // FULL feature set, and `premium` below is retained deliberately -- the tier
  // machinery, hooks and normalisation all stay wired, so introducing a charge
  // later is a config change here rather than a rebuild of the subscription
  // system. Nothing gates on premium while these two lists match.
  starter: [
    'analytics',
    'advanced_documents',
    'bulk_transactions',
    'priority_support',
    'multi_user',
    'blockchain_ledger',
    'advanced_reporting',
    'audit_logs',
    'next_step_recommendations'
  ],
  premium: [
    'analytics',
    'advanced_documents',
    'bulk_transactions',
    'priority_support',
    'multi_user',
    'blockchain_ledger',
    'advanced_reporting',
    'audit_logs',
    'next_step_recommendations'
  ]
};

/**
 * Tier metadata for display and comparison
 */
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

/**
 * Feature descriptions for UI display
 */
export const FEATURE_DESCRIPTIONS: Record<SubscriptionFeature, { name: string; description: string; icon: string }> = {
  analytics: {
    name: 'Analytics Dashboard',
    description: 'Track transaction performance and insights',
    icon: '📈'
  },
  advanced_documents: {
    name: 'Advanced Documents',
    description: 'Document verification and advanced management',
    icon: '📄'
  },
  bulk_transactions: {
    name: 'Bulk Transactions',
    description: 'Process multiple transactions simultaneously',
    icon: '📦'
  },
  priority_support: {
    name: 'Priority Support',
    description: '24/7 priority customer support',
    icon: '🚀'
  },
  multi_user: {
    name: 'Multi-User Access',
    description: 'Team collaboration with role-based access',
    icon: '👥'
  },
  blockchain_ledger: {
    name: 'Blockchain Ledger',
    description: 'Full blockchain transaction history',
    icon: '⛓️'
  },
  advanced_reporting: {
    name: 'Advanced Reporting',
    description: 'Detailed reports and data exports',
    icon: '📊'
  },
  audit_logs: {
    name: 'Audit Logs',
    description: 'Comprehensive audit trail for compliance',
    icon: '📝'
  },
  next_step_recommendations: {
    name: 'Next-Step Recommendations',
    description: 'Per-transaction blocker detection with ranked actions',
    icon: '🧭'
  }
};

/**
 * Check if a tier has access to a specific feature
 */
export function tierHasFeature(tier: SubscriptionTier, feature: SubscriptionFeature): boolean {
  return TIER_FEATURES[tier].includes(feature);
}

/**
 * Get the minimum tier required for a feature
 */
export function getMinimumTierForFeature(feature: SubscriptionFeature): SubscriptionTier | null {
  const tiers: SubscriptionTier[] = ['starter', 'premium'];

  for (const tier of tiers) {
    if (tierHasFeature(tier, feature)) {
      return tier;
    }
  }

  return null;
}

/**
 * Compare two tiers (returns positive if tier1 > tier2)
 */
export function compareTiers(tier1: SubscriptionTier, tier2: SubscriptionTier): number {
  return TIER_METADATA[tier1].order - TIER_METADATA[tier2].order;
}

/**
 * Check if tier1 is greater than or equal to tier2
 */
export function tierIsAtLeast(tier1: SubscriptionTier, tier2: SubscriptionTier): boolean {
  return compareTiers(tier1, tier2) >= 0;
}

/**
 * Get all tiers in order (lowest to highest)
 */
export function getAllTiers(): SubscriptionTier[] {
  return ['starter', 'premium'];
}

/**
 * Get upgrade path from current tier
 */
export function getUpgradeTiers(currentTier: SubscriptionTier): SubscriptionTier[] {
  const currentOrder = TIER_METADATA[currentTier].order;
  return getAllTiers().filter(tier => TIER_METADATA[tier].order > currentOrder);
}

/**
 * Translate a legacy tier string (free / individual / professional / seller)
 * from older localStorage entries or canister responses to the canonical
 * scheme. Returns the input unchanged if it is already canonical.
 *
 * Why: the old four-tier scheme (free / individual / professional / enterprise)
 * predates the canonical rename on 2026-05-17. Existing users may still hold
 * the old value in localStorage; canister responses may also carry it until
 * the canister-side migration lands.
 */
export function normalizeTier(raw: string | null | undefined): SubscriptionTier {
  switch ((raw || '').toLowerCase()) {
    case 'starter':
    case 'free':
      return 'starter';
    case 'premium':
    case 'individual':
    case 'professional':
    case 'seller':
      return 'premium';
    // 'enterprise' was retired 2026-08-21. Map it to premium, NOT starter:
    // anyone still holding the old value in localStorage or from a canister
    // response would otherwise be silently downgraded to the free tier.
    case 'enterprise':
      return 'premium';
    default:
      return 'starter';
  }
}

/**
 * Max files a user may hold per Main Wallet slot, by tier. `starter: 10` is the
 * locked free-tier cap (2026-07-14); `premium` is a tunable default
 * — raising the paid caps is a config change here, nothing else. Each file
 * writes its own on-chain anchor, so the cap bounds per-user canister writes.
 */
export const VAULT_FILES_PER_SLOT: Record<SubscriptionTier, number> = {
  starter: 10,
  premium: 30,
};

/** The per-slot file cap for a tier. */
export function vaultFilesPerSlot(tier: SubscriptionTier): number {
  return VAULT_FILES_PER_SLOT[tier];
}

/**
 * Total wallet bytes a user may hold, by tier (wallet spec 2026-08-18, decision
 * 16). Placeholders Marc tunes; changing them is a config change here only.
 */
export const VAULT_TOTAL_BYTES: Record<SubscriptionTier, number> = {
  starter: 250 * 1024 * 1024,
  premium: 1024 * 1024 * 1024,
};

/** The per-user wallet byte cap for a tier. */
export function vaultTotalBytes(tier: SubscriptionTier): number {
  return VAULT_TOTAL_BYTES[tier];
}
