// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * THE BUG THIS FILE EXISTS TO CATCH: guide titles on the hub rendered as
 * plain text that only changed colour on hover, so nothing looked
 * clickable and readers did not open them. These tests pin the
 * affordances: every published guide is a real link, every live section
 * is reachable from the pills, and every page ends with a way to get help.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { ArticleRowList, SectionPills, StillNeedHelp } from '../helpElements';
import { liveCategories, publishedInCategory, articlePath } from '../resourcesMeta';

describe('Help & Support navigation', () => {
  it('should render every published guide as a link to its article', () => {
    const articles = publishedInCategory('selling');
    render(
      <MemoryRouter>
        <ArticleRowList articles={articles} ariaLabel="Selling guides" />
      </MemoryRouter>,
    );

    const list = screen.getByRole('list', { name: 'Selling guides' });
    const links = within(list).getAllByRole('link');
    expect(links).toHaveLength(articles.length);
    for (const a of articles) {
      expect(within(list).getByRole('link', { name: new RegExp(a.title) })).toHaveAttribute(
        'href',
        articlePath(a),
      );
    }
  });

  it('should list every live section as a route pill and mark the current one', () => {
    render(
      <MemoryRouter>
        <SectionPills label="Other sections" mode="route" current="buying" />
      </MemoryRouter>,
    );

    const nav = screen.getByRole('navigation', { name: 'Other sections' });
    const live = liveCategories();
    for (const c of live.filter((x) => x.slug !== 'buying')) {
      expect(within(nav).getByRole('link', { name: c.name })).toHaveAttribute(
        'href',
        `/resources/${c.slug}`,
      );
    }
    expect(within(nav).getByText('Buying')).toHaveAttribute('aria-current', 'page');
    expect(within(nav).queryByRole('link', { name: 'Buying' })).toBeNull();
  });

  it('should jump to on-page sections when in anchor mode', () => {
    render(
      <MemoryRouter>
        <SectionPills label="Jump to a section" mode="anchor" />
      </MemoryRouter>,
    );
    for (const c of liveCategories()) {
      expect(screen.getByRole('link', { name: c.name })).toHaveAttribute('href', `#cat-${c.slug}`);
    }
  });

  it('should offer the FAQ and the contact form from the help band', () => {
    render(
      <MemoryRouter>
        <StillNeedHelp />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Read the FAQ' })).toHaveAttribute('href', '/faq');
    expect(screen.getByRole('link', { name: 'Contact support' })).toHaveAttribute('href', '/support');
  });
});
