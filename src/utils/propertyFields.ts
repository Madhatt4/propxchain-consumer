// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2025 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * Resolve the postcode used to drive the property-intelligence panel.
 *
 * The transaction record returns an empty string (canister `text`) when it has
 * no postcode, and for URL-imported listings the postcode is only persisted to
 * the listing record — never to the transaction. So the resolution must treat
 * `""` and `undefined` identically and fall through to the listing.
 *
 * Uses `||` deliberately: `??` would stop at the empty-string transaction value
 * and never reach the listing fallback, blanking the Property tab. Regression
 * guard for that bug (PR #72).
 */
export function resolvePropertyPostcode(
  transactionPostcode: string | undefined,
  listingPostcode: string | undefined,
): string {
  return transactionPostcode || listingPostcode || '';
}
