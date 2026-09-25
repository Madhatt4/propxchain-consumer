// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Which `groundsureSingles` each `groundsureBundles` entry replaces.
 *
 * INTENTIONALLY EMPTY. Groundsure publish bundle contents in their product
 * documentation; that mapping has not been transcribed yet (it is the same
 * outstanding task as mapping report_type codes onto the panel's items).
 *
 * Until an entry exists, the explainer card shows no bundle-vs-singles
 * comparison for that bundle — which is correct: we cannot honestly claim a
 * saving we cannot compute. Adding an entry lights the comparison up for
 * every customer at once, with no code change.
 *
 * Keys are ids from `groundsureBundles`; values are ids from
 * `groundsureSingles`. Both are validated by bundleComparison.ts, which
 * returns null rather than guessing when an id does not resolve.
 *
 * Example of a populated entry, for whoever fills this in:
 *   'groundsure-homebuyers': ['groundsure-flood', 'groundsure-planning'],
 */
export const groundsureBundleContents: Record<string, string[]> = {};
