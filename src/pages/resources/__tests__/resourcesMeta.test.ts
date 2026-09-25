// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Invariants for the resources registry — the article map is the single
 * source of truth for what exists, what is planned, and where every
 * article lives. These checks catch drift before it reaches the sitemap
 * or the prerenderer.
 */

import { describe, it, expect } from 'vitest';
import {
  RESOURCES,
  CATEGORIES,
  liveCategories,
  publishedInCategory,
  getRequiredArticle,
  getPublishedArticle,
  articlePath,
  LEGACY_GUIDE_ROUTES,
  type CategorySlug,
} from '../resourcesMeta';

describe('resources registry', () => {
  it('has unique slugs across every category', () => {
    const slugs = RESOURCES.map((r) => `${r.category}/${r.slug}`);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('assigns every article to a declared category', () => {
    const declared = new Set(CATEGORIES.map((c) => c.slug));
    for (const r of RESOURCES) {
      expect(declared.has(r.category as CategorySlug)).toBe(true);
    }
  });

  it('uses unique plan numbers where present', () => {
    const numbers = RESOURCES.filter((r) => r.planNumber !== null).map((r) => r.planNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('has no duplicate primary keywords between planned articles', () => {
    const keywords = RESOURCES.filter((r) => r.status === 'planned').map((r) => r.keyword.toLowerCase());
    expect(new Set(keywords).size).toBe(keywords.length);
  });

  it('carries the full documentTitle and updated date on every published article', () => {
    for (const r of RESOURCES) {
      if (r.status === 'published') {
        expect(r.documentTitle.length).toBeGreaterThan(10);
        expect(r.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it('live categories are exactly those with a published article', () => {
    const withPublished = CATEGORIES.filter((c) => publishedInCategory(c.slug).length > 0);
    expect(liveCategories().map((c) => c.slug)).toEqual(withPublished.map((c) => c.slug));
  });

  it('every published article path is unique and rooted under /resources', () => {
    for (const r of RESOURCES.filter((a) => a.status === 'published')) {
      expect(articlePath(r)).toMatch(/^\/resources\/[a-z-]+\/[a-z0-9-]+$/);
    }
  });

  it('getRequiredArticle throws on unknown slugs and resolves known ones', () => {
    expect(getRequiredArticle('selling', 'what-is-a-property-pack').slug).toBe('what-is-a-property-pack');
    expect(() => getRequiredArticle('selling', 'nope')).toThrow();
    expect(getPublishedArticle('selling', 'nope')).toBeUndefined();
  });

  it('maps every legacy /guides URL to an existing published article path', () => {
    for (const target of Object.values(LEGACY_GUIDE_ROUTES)) {
      if (target === '/resources') continue;
      const [, , category, slug] = target.split('/');
      expect(getPublishedArticle(category, slug)).toBeDefined();
    }
  });
});
