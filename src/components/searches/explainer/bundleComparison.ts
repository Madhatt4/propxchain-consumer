// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Within-supplier "is the bundle cheaper than buying these individually?".
 *
 * Deliberately within-supplier only. Ranking PropXchain's own suppliers
 * against each other inside PropXchain's own product is a commercial
 * decision, not a UI side-effect.
 *
 * Returns null rather than a guess whenever an id does not resolve: an
 * unresolvable comparison is a missing feature, a wrong one is a false price
 * claim on a consumer-facing page.
 */

import { groundsureBundles, groundsureSingles, grossPence } from '../../../services/searchProviderData';
import { groundsureBundleContents } from './groundsureBundleContents';

export interface BundleComparison {
  bundleId: string;
  bundleName: string;
  bundlePence: number;
  /** Sum of the singles this bundle replaces. */
  singlesPence: number;
  /** Positive: the bundle is cheaper. Negative: buying singly is cheaper. */
  savingPence: number;
}

export function computeBundleComparison(bundleId: string): BundleComparison | null {
  const singleIds = groundsureBundleContents[bundleId];
  if (!singleIds || singleIds.length === 0) return null;

  const bundle = groundsureBundles.find((item) => item.id === bundleId);
  if (!bundle) return null;

  const singles = singleIds.map((id) => groundsureSingles.find((item) => item.id === id));
  if (singles.some((item) => item === undefined)) return null;

  // Grossed here rather than at each render site: all three figures are only
  // ever displayed, and the saving must be the difference between the two
  // numbers the customer actually reads, not a net difference shown beside
  // VAT-inclusive prices.
  const singlesPence = grossPence(
    singles.reduce((total, item) => total + (item?.pricePence ?? 0), 0),
  );
  const bundlePence = grossPence(bundle.pricePence);

  return {
    bundleId,
    bundleName: bundle.name,
    bundlePence,
    singlesPence,
    savingPence: singlesPence - bundlePence,
  };
}

export function computeAllBundleComparisons(): BundleComparison[] {
  return groundsureBundles
    .map((bundle) => computeBundleComparison(bundle.id))
    .filter((comparison): comparison is BundleComparison => comparison !== null);
}
