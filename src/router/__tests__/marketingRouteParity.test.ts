import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * THE BUG THIS FILE EXISTS TO CATCH: a marketing page can be prerendered and
 * listed in sitemap.xml while having no matching <Route> in App.tsx. Google
 * indexes it, a human clicks the result, React mounts NotFoundRedirect instead
 * of a page, and the visitor is bounced to home.
 *
 * It is silent by construction. The prerendered HTML is real and crawlers are
 * served correctly, so nothing 404s and no build fails — only humans following
 * the link ever see it, and they just leave.
 *
 * Found 2026-08-06 on /sell-my-house and /find-a-conveyancer, which were the
 * two HIGHEST-priority entries in the sitemap (0.95, above how-it-works,
 * features and pricing at 0.9). They had been live and broken since the
 * BrowserRouter migration on 2026-06-13.
 *
 * Static analysis rather than rendering App: the contract under test is
 * "these three files agree about which marketing routes exist", which is a
 * build-time invariant. Booting the router would need auth and query providers
 * and would test React more than the contract.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

/** Routes the prerenderer emits static SEO HTML for, e.g. `route: 'pricing',`. */
function prerenderedRoutes(): string[] {
  const marketing = [...read('scripts/prerender-marketing.mjs')
    .matchAll(/^\s*route:\s*'([^']+)'/gm)].map((m) => `/${m[1]}`);
  const resources = [...read('scripts/prerender-resources.mjs')
    .matchAll(/^\s*route:\s*'([^']+)'/gm)].map((m) => `/${m[1]}`);
  return [...marketing, ...resources];
}

/** Does a prerendered route match an App <Route>, treating ":param" as one segment? */
function spaServes(route: string, appPaths: string[]): boolean {
  return appPaths.some((p) => {
    const pattern =
      '^' +
      p
        .split('/')
        .map((s) => (s.startsWith(':') ? '[^/]+' : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
        .join('/') +
      '$';
    return new RegExp(pattern).test(route);
  });
}

/** Top-level marketing paths listed in sitemap.xml, ignoring nested sections. */
function sitemapMarketingRoutes(): string[] {
  const source = read('scripts/generate-sitemap.mjs');
  return [...source.matchAll(/loc:\s*'(\/[^']*)'/g)]
    .map((m) => m[1])
    .filter((loc) => loc !== '/' && !loc.endsWith('/') && !loc.includes('.'))
    .filter((loc) => loc.split('/').length === 2);
}

/** Paths the SPA can actually render, from the <Route path="..."> table. */
function appRoutePaths(): string[] {
  const source = read('src/App.tsx');
  return [...source.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);
}

describe('marketing route parity', () => {
  it('serves a real page for every route it prerenders', () => {
    const routes = prerenderedRoutes();
    const app = appRoutePaths();

    expect(routes.length).toBeGreaterThan(0);
    expect(routes.filter((r) => !spaServes(r, app))).toEqual([]);
  });

  it('serves a real page for every top-level route in the sitemap', () => {
    const app = appRoutePaths();

    // Google reads the sitemap, so an entry here is a promise to a human that
    // the URL leads somewhere. Nested sections (/news/, /guides/...) are
    // handled by their own routes and excluded by sitemapMarketingRoutes.
    // The dynamic /resources/:category Route is covered by spaServes above.
    expect(sitemapMarketingRoutes().filter((r) => !app.includes(r))).toEqual([]);
  });
});
