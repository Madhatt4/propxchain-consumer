// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Generic "pay before invoke" mechanism for addon manifests whose
 * pricing.model isn't 'free' (packages/addons/_shared/invocation-contract.ts).
 * No addon uses this yet (ViewMyChain doesn't exist as an integration) — it's
 * the reusable checkout path the unified Stripe payments design calls for.
 * Addons share payment-worker's flat-rate PRODUCT_CATALOG —
 * add the addon's id there with kind: 'addon' and it plugs into this hook
 * with no other payment-worker/webhook changes.
 *
 * NOTE for whoever wires this up first: startCheckout redirects to Stripe
 * with no return-routing story yet. HMLRTitlePullButton.tsx and
 * SearchesPanel.tsx/PaymentSuccessPage.tsx both needed a pending-state
 * localStorage stash + a PaymentSuccessPage branch to route back to the
 * right place after Stripe's single shared success_url redirect — this
 * hook will need the same before any addon can actually resume after
 * payment. See searchCheckoutResume.ts for the pattern to follow.
 */

import { useCallback, useEffect, useState } from 'react';
import { icpService } from '@/services/icp.service';
import stripePaymentService from '@/services/stripePayment.service';
import { logger } from '@/utils/logger';

export type AddonPricingModel = 'per_use' | 'per_call' | 'subscription' | 'free';

export interface UseAddonCheckoutResult {
  /** True once the entitlement check has resolved and payment is required. */
  needsPayment: boolean;
  /** True while the initial entitlement check is in flight. */
  checking: boolean;
  /** Redirects to Stripe Checkout for this addon. Does not return in the happy path. */
  startCheckout: () => Promise<void>;
}

export function useAddonCheckout(
  addonId: string,
  pricingModel: AddonPricingModel,
  amountGbp: number,
): UseAddonCheckoutResult {
  const [needsPayment, setNeedsPayment] = useState(false);
  const [checking, setChecking] = useState(pricingModel !== 'free');

  useEffect(() => {
    if (pricingModel === 'free') {
      setNeedsPayment(false);
      setChecking(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        await icpService.initialize();
        const userPrincipalText = await icpService.getUserPrincipal();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const entitlementActor = (icpService as any).entitlementActor;
        if (!entitlementActor || typeof entitlementActor.hasActiveEntitlement !== 'function') {
          if (!cancelled) {
            setNeedsPayment(true);
            setChecking(false);
          }
          return;
        }
        const active: boolean = await entitlementActor.hasActiveEntitlement(userPrincipalText, addonId);
        if (!cancelled) {
          setNeedsPayment(!active);
          setChecking(false);
        }
      } catch (err) {
        logger.warn('Addon entitlement check failed; assuming payment required', err);
        if (!cancelled) {
          setNeedsPayment(true);
          setChecking(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [addonId, pricingModel]);

  const startCheckout = useCallback(async () => {
    const principalId = await icpService.getUserPrincipal();
    const { url } = await stripePaymentService.prepareCheckoutSession({
      principalId,
      tier: addonId,
      amount: amountGbp,
    });
    window.location.href = url;
  }, [addonId, amountGbp]);

  return { needsPayment, checking, startCheckout };
}
