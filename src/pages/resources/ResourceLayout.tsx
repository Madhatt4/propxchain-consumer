// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Resources hub — shared article layout for /resources/<category>/<slug>.
 * Editorial header (breadcrumb, category kicker, Fraunces display title,
 * lede, byline + review date), 70ch article body, one contextual
 * product link, "keep reading" rows within the category, the
 * "still need help?" band, and the register CTA band. Calm and static by design: no scroll-driven motion.
 */

import React, { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import MarketingShell from '../marketing/MarketingShell';
import {
  publishedInCategory,
  getCategory,
  type PublishedArticle,
} from './resourcesMeta';
import { ArticleRowList, HelpBreadcrumb, StillNeedHelp } from './helpElements';

interface ProductLink {
  /** Internal route, e.g. /sell-my-house */
  to: string;
  /** Anchor text — one contextual link, not a banner. */
  label: string;
  /** Sentence explaining why it matters here. Rendered before the link. */
  lead: string;
}

const Byline: React.FC<{ article: PublishedArticle }> = ({ article }) => {
  const updatedDisplay = new Date(article.updated).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return (
    <p className="font-[Geist_Mono] text-[0.68rem] uppercase tracking-[0.12em] text-[#6B7280] dark:text-[#64748B]">
      {article.readingTime}
      <span aria-hidden="true" className="mx-2">·</span>
      England &amp; Wales
      <span aria-hidden="true" className="mx-2">·</span>
      PropXchain Editorial
      <span aria-hidden="true" className="mx-2">·</span>
      Last reviewed <time dateTime={article.updated}>{updatedDisplay}</time>
    </p>
  );
};

const RelatedArticles: React.FC<{ current: PublishedArticle }> = ({ current }) => {
  const others = publishedInCategory(current.category).filter(
    (a) => a.slug !== current.slug,
  );
  if (others.length === 0) return null;
  return (
    <nav aria-label="More in this section" className="mt-16 border-t border-[#E5E7EB] pt-10 dark:border-[#1E293B]">
      <p className="font-[Geist_Mono] text-[0.65rem] uppercase tracking-[0.14em] text-[#5F8A68] dark:text-[#6EE7B7]">
        Keep reading
      </p>
      <div className="mt-5">
        <ArticleRowList articles={others} ariaLabel="More guides in this section" />
      </div>
    </nav>
  );
};

const ProductLinkBand: React.FC<{ link: ProductLink }> = ({ link }) => (
  <aside className="mt-12 rounded-lg border border-[#E5E7EB] bg-[#F0F5F0] p-6 dark:border-[#1E293B] dark:bg-[#0D1526]">
    <p className="font-[DM_Sans] text-base text-[#1A1A1A] dark:text-[#F1F5F9]">
      {link.lead}{' '}
      <Link
        to={link.to}
        className="font-medium text-[#0D9488] underline decoration-[#0D9488]/40 underline-offset-2 hover:decoration-[#0D9488] dark:text-[#14B8A6]"
      >
        {link.label}
      </Link>
    </p>
  </aside>
);

const CtaBand: React.FC = () => (
  <section className="border-t border-[#E5E7EB] bg-[#F0F5F0] dark:border-[#1E293B] dark:bg-[#0D1526]">
    <div className="mx-auto max-w-[760px] px-6 py-16 text-center">
      <h2 className="font-[Fraunces] text-[1.75rem] font-semibold tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9]">
        Ready when you are.
      </h2>
      <p className="mx-auto mt-3 max-w-xl font-[DM_Sans] text-base text-[#6B7280] dark:text-[#94A3B8]">
        Start your transaction free: no platform fee, your own providers, every
        milestone on-chain. Add the £75 AI co-pilot whenever you want it.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
        <Link
          to="/register"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#0D9488] px-7 py-3 font-[DM_Sans] text-sm font-medium text-white transition-colors hover:bg-[#0F766E]"
        >
          Start free →
        </Link>
        <Link
          to="/pricing"
          className="font-[DM_Sans] text-sm font-medium text-[#0D9488] underline decoration-[#0D9488]/40 underline-offset-2 hover:decoration-[#0D9488] dark:text-[#14B8A6]"
        >
          See pricing
        </Link>
      </div>
    </div>
  </section>
);

interface ResourceLayoutProps {
  meta: PublishedArticle;
  /** One-paragraph lede rendered under the title. */
  lede: string;
  /** Single contextual link into the relevant PropXchain flow. */
  productLink?: ProductLink;
  children: ReactNode;
}

const ResourceLayout: React.FC<ResourceLayoutProps> = ({ meta, lede, productLink, children }) => {
  useEffect(() => {
    document.title = meta.documentTitle;
    window.scrollTo(0, 0);
  }, [meta.documentTitle]);

  const category = getCategory(meta.category);

  return (
    <MarketingShell>
      <article>
        <header className="mx-auto max-w-[840px] px-6 pt-16 sm:pt-20">
          <HelpBreadcrumb category={category} />
          <h1 className="mt-5 font-[Fraunces] text-[2.4rem] font-semibold leading-[1.1] tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9] sm:text-[3rem]">
            {meta.title}
          </h1>
          <p className="mt-6 max-w-[42rem] font-[DM_Sans] text-lg leading-relaxed text-[#6B7280] dark:text-[#94A3B8]">
            {lede}
          </p>
          <div className="mt-6">
            <Byline article={meta} />
          </div>
          <div className="mt-10 h-px bg-[#E5E7EB] dark:bg-[#1E293B]" aria-hidden="true" />
        </header>

        <div className="mx-auto max-w-[720px] px-6 pb-20 pt-2">
          {children}
          {productLink && <ProductLinkBand link={productLink} />}
          <RelatedArticles current={meta} />
          <div className="mt-12">
            <StillNeedHelp />
          </div>
        </div>
      </article>
      <CtaBand />
    </MarketingShell>
  );
};

export default ResourceLayout;
