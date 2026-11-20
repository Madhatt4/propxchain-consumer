// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The TA10 guide makes a dated claim about the Law Society form (which edition
 * is current) and product claims about PropXchain's checklist. These tests pin
 * that the edition fact stays cited, that the product copy keeps its "not the
 * official form" caveat, and that the React page and its static prerender carry
 * the same flashpoints table.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';

import TA10FormGuide from '../TA10FormGuide';
import { LAW_SOCIETY_TA_FORMS_URL, TA10_EDITION, TA10_FLASHPOINTS } from '../ta10GuideData';
import { getPublishedArticle } from '../resourcesMeta';
import { resourcePages } from '../../../../scripts/prerender-resources.mjs';

const ROUTE = 'resources/selling/ta10-form-explained';

const renderGuide = (): void => {
  render(
    <ThemeProvider>
      <MemoryRouter>
        <TA10FormGuide />
      </MemoryRouter>
    </ThemeProvider>,
  );
};

describe('TA10FormGuide', () => {
  it('should be registered as a published selling guide', () => {
    expect(getPublishedArticle('selling', 'ta10-form-explained')?.title).toBe('The TA10 form explained');
  });

  it('should cite the Law Society for the current edition', () => {
    renderGuide();

    expect(screen.getByText(new RegExp(`${TA10_EDITION.edition}, ${TA10_EDITION.year}`))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Law Society' })).toHaveAttribute('href', LAW_SOCIETY_TA_FORMS_URL);
  });

  it('should list every flashpoint item in the disputes table', () => {
    renderGuide();

    const table = screen.getByRole('table', { name: /most often cause a dispute/ });

    expect(within(table).getAllByRole('row')).toHaveLength(TA10_FLASHPOINTS.length + 1);
  });

  it('should say the PropXchain checklist is not the official form', () => {
    renderGuide();

    expect(screen.getByText(/not the\s+official Law Society form/)).toBeInTheDocument();
  });
});

describe('TA10 guide prerender', () => {
  const page = resourcePages.find((p) => p.route === ROUTE);

  it('should exist with the same title as the React page', () => {
    expect(page?.title).toBe(getPublishedArticle('selling', 'ta10-form-explained')?.documentTitle);
  });

  it('should contain every flashpoint and the cited edition', () => {
    for (const f of TA10_FLASHPOINTS) {
      expect(page?.main).toContain(f.item);
      expect(page?.main).toContain(f.tip);
    }
    expect(page?.main).toContain(`${TA10_EDITION.edition}, ${TA10_EDITION.year}`);
    expect(page?.main).toContain(LAW_SOCIETY_TA_FORMS_URL);
  });

  it('should be linked from the TA6 guide and the forms overview prerenders', () => {
    for (const route of ['resources/selling/ta6-form-explained', 'resources/selling/property-information-forms-explained']) {
      expect(resourcePages.find((p) => p.route === route)?.main).toContain(`href="/${ROUTE}"`);
    }
  });
});
