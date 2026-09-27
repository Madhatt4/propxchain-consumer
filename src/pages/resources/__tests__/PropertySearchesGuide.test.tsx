// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The searches guide quotes a price and a dated statistic, and describes who
 * supplies what. These tests pin the price to what checkout actually charges,
 * keep the statistic cited, keep the anchors outside links may use, and check
 * the static prerender carries the same table.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';

import PropertySearchesGuide from '../PropertySearchesGuide';
import { CORE_PACK_FROM, HMLR_ANNUAL_REPORT_URL, SEARCHES_AT_A_GLANCE } from '../searchesGuideData';
import { getPublishedArticle } from '../resourcesMeta';
import { onesearchPacks } from '@/services/searchProviderData';
import { resourcePages } from '../../../../scripts/prerender-resources.mjs';

const renderGuide = (): { container: HTMLElement } =>
  render(
    <ThemeProvider>
      <MemoryRouter>
        <PropertySearchesGuide />
      </MemoryRouter>
    </ThemeProvider>,
  );

const cheapestPackPence = (): number => Math.min(...onesearchPacks.map((p) => p.rrpPence));

describe('PropertySearchesGuide', () => {
  it('should quote the same starting price the OneSearch checkout charges', () => {
    expect(CORE_PACK_FROM).toBe(`£${(cheapestPackPence() / 100).toFixed(2)}`);
  });

  it('should describe the cheapest pack as including an environmental report', () => {
    const cheapest = onesearchPacks.find((p) => p.rrpPence === cheapestPackPence());

    expect(cheapest?.items.some((i) => /environment|homecheck/i.test(`${i.id} ${i.name}`))).toBe(true);
  });

  it('should cite HM Land Registry for the local land charges migration figure', () => {
    renderGuide();

    expect(screen.getByRole('link', { name: 'HM Land Registry' })).toHaveAttribute('href', HMLR_ANNUAL_REPORT_URL);
  });

  it('should list every search in the at-a-glance table', () => {
    renderGuide();

    const table = screen.getByRole('table', { name: /property searches done when buying a house/i });

    expect(within(table).getAllByRole('row')).toHaveLength(SEARCHES_AT_A_GLANCE.length + 1);
  });

  it('should keep the section anchors that were public before this rewrite', () => {
    const { container } = renderGuide();

    for (const id of ['local-authority', 'drainage-water', 'environmental', 'title', 'coal-mining', 'brine', 'tin-mining', 'chancel', 'who-supplies']) {
      expect(container.querySelector(`#${id}`)).not.toBeNull();
    }
  });

  it('should not claim there is no markup on searches', () => {
    const { container } = renderGuide();

    expect(container.textContent).not.toMatch(/no (platform )?markup/i);
  });
});

describe('Searches guide prerender', () => {
  const page = resourcePages.find((p) => p.route === 'resources/searches-and-legal/property-searches-explained');

  it('should share the React page title and carry a breadcrumb name', () => {
    expect(page?.title).toBe(getPublishedArticle('searches-and-legal', 'property-searches-explained')?.documentTitle);
    expect(page?.crumb).toBe('Property searches explained');
  });

  it('should contain every at-a-glance row and the quoted price', () => {
    for (const s of SEARCHES_AT_A_GLANCE) {
      expect(page?.main).toContain(s.tells);
    }
    expect(page?.main).toContain(CORE_PACK_FROM);
  });
});
