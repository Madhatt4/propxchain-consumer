// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Feature Flags for Dual-Mode ICP Operation
 *
 * Controls whether the application uses:
 * - Per-transaction canisters (NEW) via transaction_factory
 * - Shared canister (LEGACY) via transaction_manager
 */

export interface FeatureFlags {
  /** Use per-transaction canisters instead of shared canister */
  USE_PER_TRANSACTION_CANISTERS: boolean;

  /** Enable simplified transaction creation flow */
  ENABLE_SIMPLE_CREATION: boolean;

  /** Enable Shieldpay AML/KYC integration (requires Worker deployment) */
  SHIELDPAY_ENABLED: boolean;

  /** Enable OneSearch property search ordering (via Cloudflare Worker proxy) */
  ONESEARCH_ENABLED: boolean;

  /** Enable Groundsure searches ordering (via Cloudflare Worker proxy) */
  GROUNDSURE_ENABLED: boolean;

  /** Enable tmGroup searches ordering (via Cloudflare Worker proxy) */
  TMGROUP_ENABLED: boolean;

  /** Enable ID & AML checks via the AML Worker (Verify365 first). Prices come from the worker, never this repo. */
  AML_ENABLED: boolean;

  /** Enable Conveyancer Panel firm allocation */
  CONVEYANCER_PANEL_ENABLED: boolean;
}

/**
 * Default feature flags
 * Currently defaulting to legacy mode for stability
 */
export const FEATURE_FLAGS: FeatureFlags = {
  USE_PER_TRANSACTION_CANISTERS: false,
  ENABLE_SIMPLE_CREATION: false,
  SHIELDPAY_ENABLED: false,
  // Live 2026-07-21: worker deployed with pack-signature pricing, PISCES codes
  // confirmed from OneSearch's product list.
  ONESEARCH_ENABLED: true,
  // Live 2026-08-01. Ordering still no-ops unless VITE_GROUNDSURE_WORKER_URL
  // is set at build time — see disabled() in groundsure.service.ts — so the
  // deploy workflow fails when that secret is missing rather than shipping a
  // build that silently mocks every order.
  GROUNDSURE_ENABLED: true,
  // ON as of 2026-08-14, after a test order completed end to end on 2026-08-12.
  //
  // What made it safe to flip is that the thing that was wrong is gone. The
  // deleted panel took a CLIENT-SUPPLIED total, charged it, and ordered nothing.
  // Now tmgroup-worker prices from a real Draft, stamps the figure on a row,
  // payment-worker re-derives the charge from that row, and the order is placed
  // only after Stripe confirms. The client never supplies a price.
  //
  // Unlike the other two providers, tmgroup.service does NOT mock when this is
  // off or the URL is missing — it fails explicitly. A fabricated tmGroup price
  // is the original bug, so there is deliberately no mock path to fall into.
  //
  // VITE_TMGROUP_WORKER_URL is required at build time and asserted by
  // deploy-frontend.yml.
  TMGROUP_ENABLED: true,
  // ON from 2026-09-02. The worker exposes /pricing, /checks, /order and
  // /order/:id/confirm-payment, the migration is applied, and both
  // verify365-worker targets are deployed and reporting healthy. The worker
  // serves the prices; the client never derives one.
  //
  // VITE_AML_WORKER_URL is required at build time from here on — the guard in
  // deploy-frontend.yml reads THIS value and only enforces the secret once it
  // is true, so flipping this is what arms it.
  //
  // aml.service fails explicitly when this is off — no mock path, same
  // reasoning as tmGroup.
  AML_ENABLED: true,
  CONVEYANCER_PANEL_ENABLED: true,
};

/**
 * Get feature flags for a specific user type
 * Can be extended to enable features for specific user groups
 *
 * @param _userType - Type of user (e.g., 'admin', 'beta', 'standard')
 * @returns Feature flags for the user
 */
export function getFeatureFlagsForUser(_userType?: string): FeatureFlags {
  // For now, return default flags for all users
  // In the future, this can be extended to enable features for specific groups:
  // if (_userType === 'beta') {
  //   return { ...FEATURE_FLAGS, USE_PER_TRANSACTION_CANISTERS: true };
  // }

  return FEATURE_FLAGS;
}
