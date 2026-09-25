// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * TierToggle — dev-only control to flip the local subscription tier.
 *
 * The subscription tier is currently a client mock read from
 * `localStorage['subscriptionTier']` (see useSubscription.fetchSubscriptionInfo)
 * pending the subscription canister. This toggle lets an admin switch between
 * starter and premium and immediately see what's gated — the Move Narrator
 * push, premium-only NextStepCard behaviours, analytics, etc. — by invalidating
 * the subscription query so every `useSubscription` consumer refetches.
 *
 * This only mutates local state; real entitlement will be enforced server-side
 * once the subscription canister exists.
 */

import React from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../lib/queryClient';
import { useSubscription } from '../../hooks/useSubscription';
import { normalizeTier, type SubscriptionTier } from '../../constants/subscriptionFeatures';

const TIER_STORAGE_KEY = 'subscriptionTier';
const SELECTABLE_TIERS: SubscriptionTier[] = ['starter', 'premium'];

interface TierToggleProps {
  className?: string;
}

const TierToggle: React.FC<TierToggleProps> = ({ className = '' }) => {
  const queryClient = useQueryClient();
  const { tier, isPremium, tierDisplayName } = useSubscription();

  // The stored value can be a legacy alias; normalise for the active highlight.
  const activeTier = normalizeTier(
    typeof window !== 'undefined' ? window.localStorage.getItem(TIER_STORAGE_KEY) : null,
  );

  const setTier = async (next: SubscriptionTier): Promise<void> => {
    window.localStorage.setItem(TIER_STORAGE_KEY, next);
    await queryClient.invalidateQueries({ queryKey: queryKeys.subscription.info() });
  };

  return (
    <div className={className}>
      <p className="text-sm text-muted-foreground mb-3">
        Current tier:{' '}
        <span className="text-foreground font-semibold">{tierDisplayName}</span>{' '}
        <span className="text-muted-foreground">({tier})</span>{' '}
        {isPremium ? (
          <span className="px-2 py-0.5 bg-emerald-600 text-white text-xs rounded-full">premium features on</span>
        ) : (
          <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full">free tier</span>
        )}
      </p>
      <div className="flex gap-2">
        {SELECTABLE_TIERS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => void setTier(option)}
            aria-pressed={activeTier === option}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              activeTier === option
                ? 'bg-emerald-600 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Switches the local mock tier and refetches entitlements live. Reload not required.
      </p>
    </div>
  );
};

export default TierToggle;
