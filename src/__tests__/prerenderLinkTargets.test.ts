// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pages } from '../../scripts/prerender-marketing.mjs';

/**
 * A route with no prerender is served the homepage shell, whose canonical is
 * `/`, so crawlers read it as a duplicate of the homepage. Every link a crawler
 * can follow from the static HTML must therefore land on a prerendered route
 * or a real file in public/ — otherwise the next SEO audit reports it as
 * "canonicalized to another URL". To link to a new page, prerender it first.
 */

const repoRoot = resolve(__dirname, '../..');
const prerendered = new Set(['/', ...pages.map((p) => `/${p.route}`)]);

const sources = [
  { where: 'index.html', html: readFileSync(resolve(repoRoot, 'index.html'), 'utf8') },
  ...pages.map((p) => ({ where: `/${p.route}`, html: p.main })),
];

describe('crawlable internal links', () => {
  it.each(sources)('$where links only to prerendered or static pages', ({ html }) => {
    const targets = [...html.matchAll(/href="(\/[^"#?]*)/g)].map((m) => m[1].replace(/(.)\/$/, '$1'));
    const unserved = targets.filter(
      (t) =>
        !prerendered.has(t) &&
        !['', '.html', '/index.html'].some((suffix) => existsSync(resolve(repoRoot, `public${t}${suffix}`))),
    );
    expect(unserved).toEqual([]);
  });
});
