// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * THE BUG THIS FILE EXISTS TO CATCH: /resources is a real, populated cluster
 * that nothing on the way in points at. Before this, a visitor landing on /
 * had no route to it except the footer; a crawler reading the static / had no
 * link to it at all. Both are silent — the hub still renders perfectly for
 * anyone who already knows the URL.
 *
 * Covers the four entry points that must keep working together: the landing
 * hero CTA, the landing footer, the site-wide marketing header, and the
 * crawler-facing <main> that index.html serves for /.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { HeroSection } from '@/components/landing/marketing/HeroSection';
import { SiteFooter } from '@/components/landing/marketing/SiteFooter';
import MarketingHeader from '@/pages/marketing/MarketingHeader';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { liveCategories } from '../resourcesMeta';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

describe('resources entry points', () => {
  it('should route the landing hero Help & Support CTA to the hub', () => {
    render(
      <MemoryRouter>
        <HeroSection isDark onToggleTheme={() => {}} onScrollTo={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Help & Support' })).toHaveAttribute(
      'href',
      '/resources',
    );
  });

  it('should name only live pillars in the hero supporting line', () => {
    render(
      <MemoryRouter>
        <HeroSection isDark onToggleTheme={() => {}} onScrollTo={() => {}} />
      </MemoryRouter>,
    );

    const line = screen.getByText(/Plain-English guides for every stage/);
    const live = liveCategories().map((c) => c.name);

    expect(live.length).toBeGreaterThan(0);
    for (const name of live) expect(line.textContent).toContain(name);
    // A pillar with no published article must never be advertised here.
    expect(line.textContent).not.toContain('Probate');
  });

  it('should offer Help & Support from the landing footer', () => {
    render(
      <MemoryRouter>
        <SiteFooter onScrollTo={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Help & Support' })).toHaveAttribute(
      'href',
      '/resources',
    );
  });

  it('should offer Help & Support from the site-wide marketing header', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <MarketingHeader />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Help & Support' })).toHaveAttribute(
      'href',
      '/resources',
    );
  });

  it('should link to the hub from the crawler-facing fallback for /', () => {
    const html = readFileSync(resolve(repoRoot, 'index.html'), 'utf8');
    const start = html.indexOf('<main id="seo-fallback"');
    const end = html.indexOf('</main>', start);
    const main = start === -1 || end === -1 ? null : html.slice(start, end);

    expect(main).toBeTruthy();
    expect(main).toContain('href="/resources"');
  });
});
