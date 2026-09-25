/**
 * Generate dist/sitemap.xml at build time.
 *
 * Runs after the Vite build + prerender so the sitemap is the single source of
 * truth for the live URL set — no hand-maintained public/sitemap.xml drifting
 * out of sync with the routes. `lastmod` is the real last-meaningful-change date
 * per route (Google treats lastmod as a hint and distrusts sitemaps that re-date
 * every URL on every build), so bump a route's date here when its content
 * actually changes rather than stamping the build date across the board.
 */

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const SITE = 'https://propxchain.com';

// loc is relative to SITE. Keep this list in step with the prerendered routes
// (scripts/prerender-marketing.mjs + prerender-resources.mjs) and the static
// public/ pages (news, llms).
const routes = [
  { loc: '/', lastmod: '2026-06-22', changefreq: 'weekly', priority: '1.0' },
  { loc: '/how-it-works', lastmod: '2026-06-13', changefreq: 'monthly', priority: '0.9' },
  { loc: '/features', lastmod: '2026-06-13', changefreq: 'monthly', priority: '0.9' },
  { loc: '/pricing', lastmod: '2026-06-13', changefreq: 'monthly', priority: '0.9' },
  { loc: '/sell-my-house', lastmod: '2026-06-13', changefreq: 'weekly', priority: '0.95' },
  { loc: '/find-a-conveyancer', lastmod: '2026-06-13', changefreq: 'weekly', priority: '0.95' },
  { loc: '/news/', lastmod: '2026-06-12', changefreq: 'weekly', priority: '0.8' },
  { loc: '/news/opda-sandbox-hackathons', lastmod: '2026-06-12', changefreq: 'monthly', priority: '0.8' },
  { loc: '/faq', lastmod: '2026-06-12', changefreq: 'monthly', priority: '0.8' },
  { loc: '/resources', lastmod: '2026-09-04', changefreq: 'weekly', priority: '0.8' },
  { loc: '/resources/getting-started', lastmod: '2026-09-04', changefreq: 'monthly', priority: '0.8' },
  { loc: '/resources/selling', lastmod: '2026-09-01', changefreq: 'monthly', priority: '0.8' },
  { loc: '/resources/buying', lastmod: '2026-09-01', changefreq: 'monthly', priority: '0.8' },
  { loc: '/resources/searches-and-legal', lastmod: '2026-09-01', changefreq: 'monthly', priority: '0.8' },
  { loc: '/resources/industry-and-reform', lastmod: '2026-09-01', changefreq: 'monthly', priority: '0.8' },
  { loc: '/resources/selling/what-is-a-property-pack', lastmod: '2026-08-14', changefreq: 'monthly', priority: '0.8' },
  { loc: '/resources/selling/property-information-forms-explained', lastmod: '2026-08-21', changefreq: 'monthly', priority: '0.8' },
  { loc: '/resources/buying/how-long-does-conveyancing-take', lastmod: '2026-06-12', changefreq: 'monthly', priority: '0.8' },
  { loc: '/resources/industry-and-reform/baspi-explained', lastmod: '2026-06-12', changefreq: 'monthly', priority: '0.8' },
  { loc: '/resources/searches-and-legal/property-searches-explained', lastmod: '2026-08-21', changefreq: 'monthly', priority: '0.8' },
  { loc: '/resources/getting-started/how-to-sign-in', lastmod: '2026-09-04', changefreq: 'monthly', priority: '0.8' },
  { loc: '/about', lastmod: '2026-06-13', changefreq: 'monthly', priority: '0.7' },
  { loc: '/llms.txt', lastmod: '2026-06-22', changefreq: 'weekly', priority: '0.5' },
  { loc: '/llms-full.txt', lastmod: '2026-06-22', changefreq: 'weekly', priority: '0.5' },
];

const body = routes
  .map(
    ({ loc, lastmod, changefreq, priority }) =>
      `  <url>\n` +
      `    <loc>${SITE}${loc}</loc>\n` +
      `    <lastmod>${lastmod}</lastmod>\n` +
      `    <changefreq>${changefreq}</changefreq>\n` +
      `    <priority>${priority}</priority>\n` +
      `  </url>`,
  )
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

writeFileSync(join(DIST, 'sitemap.xml'), xml);
console.log(`Generated dist/sitemap.xml (${routes.length} URLs).`);
