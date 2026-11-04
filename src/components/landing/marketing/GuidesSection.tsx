// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Guides strip — six of the published Resources articles, linked from the
 * homepage. The homepage is the site's strongest page, and the guides had no
 * link from it, so they ranked poorly for queries they answer well (the TA6
 * guide averaged around #56 for a 3,600-a-month query). Cards read their
 * title, teaser and reading time from resourcesMeta, so the strip can never
 * advertise an article under a different name or a dead URL:
 * getRequiredArticle throws if a slug is unpublished.
 */

import { Link } from 'react-router-dom';

import {
  articlePath,
  getCategory,
  getRequiredArticle,
  type CategorySlug,
  type PublishedArticle,
} from '@/pages/resources/resourcesMeta';

/** Ordered by search demand for the question each guide answers. */
export const HOMEPAGE_GUIDES: ReadonlyArray<{ category: CategorySlug; slug: string }> = [
  { category: 'selling', slug: 'ta6-form-explained' },
  { category: 'buying', slug: 'how-long-does-conveyancing-take' },
  { category: 'searches-and-legal', slug: 'property-searches-explained' },
  { category: 'selling', slug: 'what-is-a-property-pack' },
  { category: 'selling', slug: 'property-information-forms-explained' },
  { category: 'industry-and-reform', slug: 'baspi-explained' },
];

function GuideCard({ article }: { article: PublishedArticle }): JSX.Element {
  return (
    <Link to={articlePath(article)} className="card reveal block" style={{ padding: '1.6rem' }}>
      <span className="num" style={{ fontSize: '0.7rem', color: 'var(--t)', letterSpacing: '0.08em' }}>
        {getCategory(article.category)?.name} · {article.readingTime}
      </span>
      <h3
        className="font-display"
        style={{ fontWeight: 700, fontSize: '1.15rem', margin: '0.6rem 0 0.5rem', color: 'var(--fg)' }}
      >
        {article.title}
      </h3>
      <p style={{ fontSize: '0.88rem', color: 'var(--fg-2)', lineHeight: 1.65, margin: 0 }}>{article.teaser}</p>
    </Link>
  );
}

export function GuidesSection(): JSX.Element {
  const articles = HOMEPAGE_GUIDES.map((g) => getRequiredArticle(g.category, g.slug));

  return (
    <section
      id="guides"
      className="section-pad divider-top"
      style={{ background: 'var(--ink)' }}
      data-screen-label="Guides"
    >
      <div className="wrap">
        <div className="reveal">
          <span className="eyebrow">Guides</span>
        </div>
        <h2 className="h-sec reveal">
          Know what happens next, <span className="key">in plain English.</span>
        </h2>

        <div className="px-g3 gap-5 mt-12">
          {articles.map((article) => (
            <GuideCard key={article.slug} article={article} />
          ))}
        </div>

        <p className="reveal mt-10" style={{ fontSize: '0.95rem', color: 'var(--fg-2)' }}>
          <Link to="/resources" className="hover:text-[color:var(--t)]" style={{ color: 'var(--t)' }}>
            See all guides →
          </Link>
        </p>
      </div>
    </section>
  );
}
