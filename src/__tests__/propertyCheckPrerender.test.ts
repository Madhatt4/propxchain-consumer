// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';

import { pages } from '../../scripts/prerender-marketing.mjs';
import {
  PROPERTY_CHECK_FAQS,
  PROPERTY_CHECK_HERO,
  PROPERTY_CHECK_SECTIONS,
} from '../pages/marketing/propertyCheckData';

/**
 * Crawlers read the prerendered /property-check HTML, people read the React
 * page. Both come from propertyCheckData.mjs; this guards that the prerender
 * actually uses it, and that the FAQPage JSON-LD matches the visible questions
 * (Google requires the two to agree).
 */

const decode = (s: string): string => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

describe('/property-check prerender', () => {
  const page = pages.find((p) => p.route === 'property-check');

  it('should be registered with the prerenderer', () => {
    expect(page).toBeDefined();
  });

  it('should carry the shared H1, section headings and every FAQ in its static body', () => {
    const main = decode(page?.main ?? '');

    expect(main).toContain(`<h1>${PROPERTY_CHECK_HERO.h1}</h1>`);
    for (const section of PROPERTY_CHECK_SECTIONS) {
      expect(main).toContain(section.heading);
    }
    for (const faq of PROPERTY_CHECK_FAQS) {
      expect(main).toContain(faq.q);
      expect(main).toContain(faq.a);
    }
  });

  it('should emit FAQPage JSON-LD that mirrors the visible questions exactly', () => {
    const jsonLd = page?.jsonLd as { '@type': string; mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }> };

    expect(jsonLd['@type']).toBe('FAQPage');
    expect(jsonLd.mainEntity.map((q) => q.name)).toEqual(PROPERTY_CHECK_FAQS.map((f) => f.q));
    expect(jsonLd.mainEntity.map((q) => q.acceptedAnswer.text)).toEqual(PROPERTY_CHECK_FAQS.map((f) => f.a));
  });
});
