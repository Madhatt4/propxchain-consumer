// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The TA6 guide makes dated claims about the Law Society form and product
 * claims about PropXchain. These tests pin that the edition facts stay cited,
 * that the product copy keeps its "not the official form" caveat, and that the
 * React page and its static prerender carry the same 15 sections.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';

import TA6FormGuide from '../TA6FormGuide';
import { LAW_SOCIETY_TA6_URL, TA6_SECTIONS } from '../ta6GuideData';
import { getPublishedArticle } from '../resourcesMeta';
import { resourcePages } from '../../../../scripts/prerender-resources.mjs';

const renderGuide = (): void => {
  render(
    <ThemeProvider>
      <MemoryRouter>
        <TA6FormGuide />
      </MemoryRouter>
    </ThemeProvider>,
  );
};

describe('TA6FormGuide', () => {
  it('should be registered as a published selling guide', () => {
    expect(getPublishedArticle('selling', 'ta6-form-explained')?.title).toBe('The TA6 form explained');
  });

  it('should cite the Law Society for the 6th edition facts', () => {
    renderGuide();

    expect(screen.getAllByText(/30 March 2026/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Law Society' })).toHaveAttribute('href', LAW_SOCIETY_TA6_URL);
  });

  it('should list all 15 sections in the section table', () => {
    renderGuide();

    const table = screen.getByRole('table', { name: /15 sections of the TA6/ });

    expect(within(table).getAllByRole('row')).toHaveLength(TA6_SECTIONS.length + 1);
    expect(TA6_SECTIONS.map((s) => s.n)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  });

  it('should say the PropXchain version paraphrases and the official wording governs', () => {
    renderGuide();

    expect(screen.getByText(/paraphrases the questions/)).toBeInTheDocument();
    expect(screen.getByText(/official Law Society wording is what governs your answers/)).toBeInTheDocument();
  });
});

describe('TA6 guide prerender', () => {
  const page = resourcePages.find((p) => p.route === 'resources/selling/ta6-form-explained');

  it('should exist with the same title as the React page', () => {
    expect(page?.title).toBe(getPublishedArticle('selling', 'ta6-form-explained')?.documentTitle);
  });

  it('should contain every section title and summary from the shared data', () => {
    for (const s of TA6_SECTIONS) {
      expect(page?.main).toContain(`${s.n}. ${s.title}`);
      expect(page?.main).toContain(s.asks);
    }
  });
});
