// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Single source of truth for the security headers served in BOTH environments:
 * the Vite dev server (`vite.config.ts`) and production on the IC asset
 * canister (`public/.ic-assets.json5`).
 *
 * The two used to be hand-maintained copies and had already drifted — dev
 * carried two font hosts in connect-src that prod did not. A CSP that is
 * looser in dev than in prod is worse than useless: it lets a request pass
 * locally and fail only once it is live. The vitest guard in
 * `src/__tests__/config/security-headers.test.ts` fails the suite if
 * `.ic-assets.json5` stops matching this file.
 */

/**
 * SHA-256 of each executable inline <script> in index.html (security scan M4).
 * With these listed, browsers ignore 'unsafe-inline' for scripts, so injected
 * markup can no longer run script. The hashes are of the LF-checked-out source,
 * which is byte-for-byte what the built site serves;
 * src/__tests__/config/security-headers.test.ts fails if index.html changes
 * without updating them. 'unsafe-eval' stays until a click-through proves
 * nothing needs it (carded).
 */
export const INLINE_SCRIPT_HASHES = [
  "'sha256-cXiZeUoUH0eop2rOqJhm04zC59cbQUgK4gBwP0p8/mk='", // gtag dataLayer bootstrap
  "'sha256-YyBAZ4lLS6ENQIbBKRAUzKtEnmuHQ6iJ/zm7ENQCa6k='", // theme before React mounts
  "'sha256-gGt2r0fTuR5SCRnzwozO0D+RekZBjM33H8tcx8BPkO8='", // BrowserRouter auth redirects
  "'sha256-08FPA4mXi+p4WsPjojT/Zm+jSitvKMB/iOJ/Q13lH44='", // stale service-worker cleanup
]

/** @type {Record<string, string[]>} */
const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", ...INLINE_SCRIPT_HASHES, "'unsafe-eval'", 'https://www.googletagmanager.com'],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'img-src': [
    "'self'",
    'data:',
    'blob:',
    'https://*.google-analytics.com',
    'https://*.googletagmanager.com',
    'https://media.rightmove.co.uk',
    'https://*.onthemarket.com',
    'https://*.purplebricks.co.uk',
    'https://*.basemaps.cartocdn.com',
    // Map tiles (#400): CARTO serves the bare host, OSM is the no-key fallback.
    'https://basemaps.cartocdn.com',
    'https://tile.openstreetmap.org',
  ],
  'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
  'connect-src': [
    "'self'",
    'https://api.propxchain.com',
    'https://*.google-analytics.com',
    'https://analytics.google.com',
    'https://*.analytics.google.com',
    'https://*.googletagmanager.com',
    // Google Tag Assistant lists these two for measurement (Ads linking / signals).
    'https://stats.g.doubleclick.net',
    'https://www.google.com',
    'https://ic0.app',
    'https://*.ic0.app',
    'https://icp0.io',
    'https://*.icp0.io',
    'https://icp-api.io',
    'https://identity.ic0.app',
    'https://id.ai',
    'https://*.supabase.co',
    // M4: exact hosts, not *.workers.dev / *.onrender.com (anyone can host
    // there, so those wildcards let injected script send data to its own
    // Worker). *.hatton-marc.workers.dev is only this Cloudflare account.
    'https://*.hatton-marc.workers.dev',
    'https://propxchain.onrender.com',
    'https://propxchain-proxy-render.onrender.com',
    'https://propxchain-property-enrich.onrender.com',
    'https://propxchain-4k8l.onrender.com',
    'https://*.stripe.com',
    'https://landregistry.data.gov.uk',
    'https://api.postcodes.io',
    'https://environment.data.gov.uk',
    'https://www.planning.data.gov.uk',
    'https://www.planit.org.uk',
  ],
  'frame-src': ["'self'", 'https://identity.ic0.app', 'https://id.ai', 'https://*.stripe.com'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'", 'https://*.stripe.com'],
}

/** @param {Record<string, string[]>} directives */
const serialise = (directives) => `${Object.entries(directives)
  .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
  .join('; ')};`

export const CONTENT_SECURITY_POLICY = serialise(CSP_DIRECTIVES)

/**
 * The Vite dev server injects its own inline React-refresh preamble, which no
 * fixed hash can cover, so dev swaps the inline-script hashes for
 * 'unsafe-inline'. That swap is the ONLY difference; the test enforces it.
 */
export const DEV_CONTENT_SECURITY_POLICY = serialise({
  ...CSP_DIRECTIVES,
  'script-src': CSP_DIRECTIVES['script-src'].filter((s) => !INLINE_SCRIPT_HASHES.includes(s)).concat("'unsafe-inline'"),
})

export const SECURITY_HEADERS = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
}

export const DEV_SECURITY_HEADERS = {
  ...SECURITY_HEADERS,
  'Content-Security-Policy': DEV_CONTENT_SECURITY_POLICY,
}
