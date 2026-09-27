// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Postbuild: static redirect pages for the old /guides URLs.
 *
 * Without these the canister falls back to the SPA shell (canonical "/") and
 * only JS moves the visitor on, so Search Console showed the /guides and
 * /resources copies of the same guide splitting impressions. Each page is a
 * 0-second meta refresh plus a canonical to the new URL, which Google reads as
 * a permanent redirect. Output: dist/guides/{slug}/index.html.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEGACY_GUIDE_ROUTES } from '../src/pages/resources/legacyGuideRoutes.mjs';

const SITE = 'https://propxchain.com';

/** Standalone redirect document for one legacy path. */
export function legacyRedirectHtml(target) {
  const url = `${SITE}${target}`;
  return `<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8" />
    <title>This guide has moved · PropXchain</title>
    <link rel="canonical" href="${url}" />
    <meta http-equiv="refresh" content="0; url=${target}" />
  </head>
  <body>
    <p>This guide has moved to <a href="${target}">${url}</a>.</p>
  </body>
</html>
`;
}

/** dist-relative output file for a legacy path, e.g. guides/baspi-explained/index.html. */
export function legacyRedirectFile(legacyPath) {
  return join(legacyPath.replace(/^\//, ''), 'index.html');
}

function main() {
  const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
  for (const [legacyPath, target] of Object.entries(LEGACY_GUIDE_ROUTES)) {
    const file = join(dist, legacyRedirectFile(legacyPath));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, legacyRedirectHtml(target));
  }
  console.log(`Wrote ${Object.keys(LEGACY_GUIDE_ROUTES).length} legacy /guides redirect pages.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
