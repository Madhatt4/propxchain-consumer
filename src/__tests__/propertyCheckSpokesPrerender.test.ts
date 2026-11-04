// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';

import { pages } from '../../scripts/prerender-marketing.mjs';
import { PROPERTY_CHECK_SECTIONS } from '../pages/marketing/propertyCheckData';
import { PROPERTY_CHECK_SPOKES } from '../pages/marketing/propertyCheckSpokesData';

/**
 * Crawlers read the prerendered topic pages, people read the React ones; both
 * come from propertyCheckSpokesData.mjs. This guards that the prerender uses
 * that module, that the FAQPage JSON-LD matches the visible questions, and
 * that the hub links each topic page so crawlers can find it.
 */

const decode = (s: string): string =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

describe.each(PROPERTY_CHECK_SPOKES.map((s) => [s.route, s] as const))('/%s prerender', (route, spoke) => {
  const page = pages.find((p) => p.route === route);

  it('should be registered with the spoke’s own title and description', () => {
    expect(page?.title).toBe(spoke.meta.title);
    expect(page?.description).toBe(spoke.meta.description);
  });

  it('should carry the H1, every section heading and every FAQ in its static body', () => {
    const main = decode(page?.main ?? '');

    expect(main).toContain(`<h1>${spoke.h1}</h1>`);
    for (const section of spoke.sections) expect(main).toContain(section.heading);
    for (const faq of spoke.faqs) {
      expect(main).toContain(faq.q);
      expect(main).toContain(faq.a);
    }
  });

  it('should emit FAQPage JSON-LD that mirrors the visible questions exactly', () => {
    const jsonLd = page?.jsonLd as { '@type': string; mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }> };

    expect(jsonLd['@type']).toBe('FAQPage');
    expect(jsonLd.mainEntity.map((q) => q.name)).toEqual(spoke.faqs.map((f) => f.q));
    expect(jsonLd.mainEntity.map((q) => q.acceptedAnswer.text)).toEqual(spoke.faqs.map((f) => f.a));
  });

  it('should be linked from the /property-check hub, in the page and the crawler HTML', () => {
    const hub = pages.find((p) => p.route === 'property-check');

    expect(PROPERTY_CHECK_SECTIONS.some((s) => s.more?.to === `/${route}`)).toBe(true);
    expect(hub?.main).toContain(`href="/${route}"`);
  });
});

describe('property check claims', () => {
  it('should not claim registered parks and gardens, which the heritage check does not query', () => {
    const copy = JSON.stringify([PROPERTY_CHECK_SECTIONS, PROPERTY_CHECK_SPOKES, pages.find((p) => p.route === 'property-check')]);

    expect(copy.toLowerCase()).not.toMatch(/park and garden|parks and gardens/);
  });
});
