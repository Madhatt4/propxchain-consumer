// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Old /guides URLs that now live under /resources.
 *
 * Plain ESM (.mjs) on purpose: imported by BOTH the React router (via
 * resourcesMeta.ts) and the Node postbuild script
 * scripts/prerender-legacy-redirects.mjs. The SPA <Navigate> only runs once
 * JS has executed, and the asset canister cannot send a 301, so Google kept
 * indexing both copies of the same guide. The postbuild writes a static
 * meta-refresh page at each old path — Google treats a 0-second refresh as a
 * permanent redirect — and both sides read this one map so they cannot drift.
 *
 * Types live in the sibling legacyGuideRoutes.d.ts.
 */
export const LEGACY_GUIDE_ROUTES = Object.freeze({
  '/guides': '/resources',
  '/guides/what-is-a-property-pack': '/resources/selling/what-is-a-property-pack',
  '/guides/how-long-does-conveyancing-take':
    '/resources/buying/how-long-does-conveyancing-take',
  '/guides/baspi-explained': '/resources/industry-and-reform/baspi-explained',
  '/guides/property-searches-explained':
    '/resources/searches-and-legal/property-searches-explained',
  '/guides/property-information-forms-explained':
    '/resources/selling/property-information-forms-explained',
});
