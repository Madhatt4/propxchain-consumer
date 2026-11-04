// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { articlePath, getRequiredArticle } from '@/pages/resources/resourcesMeta';

import { GuidesSection, HOMEPAGE_GUIDES } from '../GuidesSection';

const here = dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(resolve(here, '../../../../../index.html'), 'utf8');

const guides = HOMEPAGE_GUIDES.map((g) => getRequiredArticle(g.category, g.slug));

function renderSection(): void {
  render(
    <MemoryRouter>
      <GuidesSection />
    </MemoryRouter>,
  );
}

describe('GuidesSection', () => {
  it('should link six published guides by their real titles and URLs', () => {
    renderSection();

    expect(guides).toHaveLength(6);
    for (const guide of guides) {
      expect(screen.getByRole('heading', { name: guide.title }).closest('a')).toHaveAttribute('href', articlePath(guide));
    }
  });

  it('should link to the full guides hub', () => {
    renderSection();

    expect(screen.getByRole('link', { name: /See all guides/ })).toHaveAttribute('href', '/resources');
  });

  it('should give non-JS crawlers the same guide links in the homepage fallback', () => {
    const start = indexHtml.indexOf('<main id="seo-fallback"');
    const main = indexHtml.slice(start, indexHtml.indexOf('</main>', start));

    for (const guide of guides) {
      expect(main).toContain(`<a href="${articlePath(guide)}">${guide.title}</a>`);
    }
  });

  it('should link the free property check from the crawler fallback and site nav', () => {
    expect(indexHtml.match(/href="\/property-check"/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});
