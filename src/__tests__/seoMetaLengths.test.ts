// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pages } from '../../scripts/prerender-marketing.mjs';

/**
 * Search engines truncate titles past ~60 characters and snippets past ~160,
 * and treat snippets under ~70 as too thin to describe the page. An SEO audit
 * of propxchain.com flagged both on most public pages, so every indexable page
 * is held to those bounds here: the prerendered routes, plus the hand-written
 * static pages that never pass through the prerenderer.
 */

const TITLE_MAX = 60;
const DESCRIPTION_MIN = 70;
const DESCRIPTION_MAX = 160;

const STATIC_PAGES = [
  'index.html',
  'public/agent.html',
  'public/news/index.html',
  'public/news/opda-sandbox-hackathons/index.html',
];

function staticMeta(path: string): { title: string; description: string } {
  const html = readFileSync(resolve(__dirname, '../..', path), 'utf8');
  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '';
  const description = html.match(/<meta\s+name="description"\s+content="([^"]*)"/)?.[1] ?? '';
  // Measure what the reader sees: entities decoded, source line-wrapping collapsed.
  const [plainTitle, plainDescription] = [title, description].map((s) =>
    s.replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim(),
  );
  return { title: plainTitle, description: plainDescription };
}

const allPages = [
  ...pages.map((p) => ({ where: `/${p.route}`, title: p.title, description: p.description })),
  ...STATIC_PAGES.map((path) => ({ where: path, ...staticMeta(path) })),
];

describe('SEO title and meta description lengths', () => {
  it.each(allPages)('$where has a title of at most 60 characters', ({ title }) => {
    expect(title.length).toBeGreaterThan(0);
    expect(title.length).toBeLessThanOrEqual(TITLE_MAX);
  });

  it.each(allPages)('$where has a meta description of 70–160 characters', ({ description }) => {
    expect(description.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
    expect(description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
  });

  it('gives every prerendered route its own title', () => {
    const titles = pages.map((p) => p.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});
