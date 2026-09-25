// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2025 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { icpService } from '../services/icp.service';
import {
  SubscriptionTier,
  SubscriptionFeature,
  TIER_METADATA,
  tierHasFeature,
  getMinimumTierForFeature,
  compareTiers,
  normalizeTier
} from '../constants/subscriptionFeatures';
import { logger } from '@/utils/logger';

/**
 * Subscription information returned from canister
 */
export interface SubscriptionInfo {
  tier: SubscriptionTier;
  expiry: Date | null;
  quotaRemaining: number;
  isLoading: boolean;
  error: string | null;
}

/**
 * Extended subscription info with utility methods
 */
export interface UseSubscriptionReturn extends SubscriptionInfo {
  canAccess: (feature: SubscriptionFeature) => boolean;
  refreshSubscription: () => Promise<void>;
  isPremium: boolean;
  tierDisplayName: string;
  tierColor: string;
  isExpired: boolean;
  daysUntilExpiry: number | null;
}

/**
 * Fetch subscription info from canister
 * TODO: Replace with actual canister call when subscription canister is deployed
 */
async function fetchSubscriptionInfo(): Promise<{
  tier: SubscriptionTier;
  expiry: bigint | null;
  quotaRemaining: number;
}> {
  await icpService.initialize();

  // TODO: Replace with actual canister method
  // Example: const result = await icpService.subscriptionActor.getMySubscription();

  // TEMPORARY: Mock data - derive from user profile or localStorage
  // In production, this would come from a subscription canister
  try {
    // Initialize ICP service to ensure we're authenticated
    // Profile could be used in the future to derive subscription from user data
    await icpService.getMyProfile();

    // Check if user has a premium indicator in their profile.
    // Backward-compat: legacy values ('free' / 'individual' / 'professional' /
    // 'seller') get translated to the canonical scheme on read.
    const rawStoredTier = localStorage.getItem('subscriptionTier');
    const tier = normalizeTier(rawStoredTier);

    return {
      tier,
      expiry: null, // TODO: Get from canister
      quotaRemaining: tier === 'starter' ? 3 : 999 // TODO: Get from canister
    };
  } catch (error) {
    logger.error('Error fetching subscription info:', error);
    return {
      tier: 'starter',
      expiry: null,
      quotaRemaining: 3
    };
  }
}

/**
 * Hook for managing subscription information and tier-based access control
 *
 * @example
 * ```tsx
 * const { tier, canAccess, isPremium, isLoading } = useSubscription();
 *
 * if (canAccess('analytics')) {
 *   return <AnalyticsPage />;
 * }
 *
 * return <UpgradePrompt feature="analytics" />;
 * ```
 */
export function useSubscription(): UseSubscriptionReturn {
  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: queryKeys.subscription.info(),
    queryFn: fetchSubscriptionInfo,
    staleTime: 5 * 60 * 1000, // 5 minutes - subscriptions don't change often
    gcTime: 30 * 60 * 1000, // 30 minutes cache
    refetchOnWindowFocus: false,
    retry: 2
  });

  // Calculate derived values
  const tier = data?.tier || 'starter';
  const expiry = data?.expiry ? new Date(Number(data.expiry) / 1000000) : null; // Convert nanoseconds to ms
  const quotaRemaining = data?.quotaRemaining ?? 0;

  const isExpired = expiry ? expiry.getTime() < Date.now() : false;

  const daysUntilExpiry = expiry
    ? Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const isPremium = tier !== 'starter';

  const metadata = TIER_METADATA[tier];

  /**
   * Check if user has access to a specific feature
   */
  const canAccess = (feature: SubscriptionFeature): boolean => {
    // If subscription is expired, downgrade to starter tier access
    if (isExpired) {
      return tierHasFeature('starter', feature);
    }

    return tierHasFeature(tier, feature);
  };

  /**
   * Refresh subscription info from canister
   */
  const refreshSubscription = async (): Promise<void> => {
    await refetch();
  };

  return {
    tier,
    expiry,
    quotaRemaining,
    isLoading,
    error: error ? (error as Error).message : null,
    canAccess,
    refreshSubscription,
    isPremium,
    tierDisplayName: metadata.displayName,
    tierColor: metadata.color,
    isExpired,
    daysUntilExpiry
  };
}

/**
 * Hook to check if user can access a specific feature
 * Convenience hook for simpler use cases
 *
 * @example
 * ```tsx
 * const canAccessAnalytics = useCanAccessFeature('analytics');
 *
 * if (!canAccessAnalytics) {
 *   return <UpgradePrompt feature="analytics" />;
 * }
 * ```
 */
export function useCanAccessFeature(feature: SubscriptionFeature): boolean {
  const { canAccess, isLoading } = useSubscription();

  // While loading, deny access to premium features
  if (isLoading) {
    return false;
  }

  return canAccess(feature);
}

/**
 * Hook to get minimum tier required for a feature
 *
 * @example
 * ```tsx
 * const minTier = useMinimumTierForFeature('analytics');
 * // Returns 'premium'
 * ```
 */
export function useMinimumTierForFeature(feature: SubscriptionFeature): SubscriptionTier | null {
  return getMinimumTierForFeature(feature);
}

/**
 * Hook to check if user's tier is at least the specified tier
 *
 * @example
 * ```tsx
 * const isPremium = useIsTierAtLeast('premium');
 * ```
 */
export function useIsTierAtLeast(requiredTier: SubscriptionTier): boolean {
  const { tier, isLoading, isExpired } = useSubscription();

  if (isLoading) {
    return false;
  }

  // If expired, treat as starter tier
  if (isExpired) {
    return compareTiers('starter', requiredTier) >= 0;
  }

  return compareTiers(tier, requiredTier) >= 0;
}

/**
 * Hook to get quota status (for transaction limits, etc.)
 *
 * @example
 * ```tsx
 * const { quotaRemaining, quotaLimit, quotaPercentage, isNearLimit } = useQuotaStatus();
 * ```
 */
export function useQuotaStatus(): {
  quotaRemaining: number;
  quotaLimit: number | null;
  quotaPercentage: number;
  isNearLimit: boolean;
  isAtLimit: boolean;
} {
  const { tier, quotaRemaining } = useSubscription();
  const metadata = TIER_METADATA[tier];

  const quotaLimit = metadata.transactionLimit;
  const quotaPercentage = quotaLimit
    ? ((quotaLimit - quotaRemaining) / quotaLimit) * 100
    : 0;

  const isNearLimit = quotaLimit ? quotaPercentage >= 80 : false;
  const isAtLimit = quotaRemaining <= 0;

  return {
    quotaRemaining,
    quotaLimit,
    quotaPercentage,
    isNearLimit,
    isAtLimit
  };
}
