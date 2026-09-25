// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Help & Support hub — /resources. Section pills jump down the page; each
 * live category is a bordered list of article rows that read as links at
 * rest. Categories without published articles stay off the page until
 * they have real content (no empty pillars). Ends on "Still need help?"
 * so the FAQ and the contact form are one click from every guide.
 */

import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import MarketingShell from '../marketing/MarketingShell';
import { liveCategories, publishedInCategory, type ResourceCategory } from './resourcesMeta';
import {
  ArticleRowList,
  Eyebrow,
  HelpBreadcrumb,
  SectionPills,
  StillNeedHelp,
} from './helpElements';

const CategorySection: React.FC<{ category: ResourceCategory; index: number }> = ({
  category,
  index,
}) => {
  const articles = publishedInCategory(category.slug);
  return (
    <section
      id={`cat-${category.slug}`}
      aria-labelledby={`cat-${category.slug}-title`}
      className="scroll-mt-24 grid gap-x-12 gap-y-5 border-t border-[#E5E7EB] py-12 first:border-t-0 first:pt-0 dark:border-[#1E293B] md:grid-cols-[240px_1fr]"
    >
      <div>
        <div className="md:sticky md:top-8">
          <Eyebrow>{String(index + 1).padStart(2, '0')}</Eyebrow>
          <h2
            id={`cat-${category.slug}-title`}
            className="mt-3 font-[Fraunces] text-[1.6rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9]"
          >
            {category.name}
          </h2>
          <p className="mt-2 font-[DM_Sans] text-[0.95rem] leading-relaxed text-[#4B5563] dark:text-[#94A3B8]">
            {category.description}
          </p>
          <Link
            to={`/resources/${category.slug}`}
            className="mt-4 inline-flex min-h-11 items-center font-[DM_Sans] text-sm font-medium text-[#0F766E] underline decoration-[#0F766E]/40 underline-offset-[3px] hover:decoration-[#0F766E] dark:text-[#2DD4BF] dark:decoration-[#2DD4BF]/40"
          >
            Open this section
          </Link>
        </div>
      </div>
      <ArticleRowList articles={articles} ariaLabel={`${category.name} guides`} />
    </section>
  );
};

const ResourcesHubPage: React.FC = () => {
  useEffect(() => {
    document.title = 'Help & Support — Plain-English Home Moving Guides · PropXchain';
    window.scrollTo(0, 0);
  }, []);

  const categories = liveCategories();
  const guideCount = categories.reduce((n, c) => n + publishedInCategory(c.slug).length, 0);

  return (
    <MarketingShell>
      <main className="mx-auto max-w-[1040px] px-6 pb-24 pt-16 sm:pt-20">
        <HelpBreadcrumb />
        <div className="mt-6">
          <Eyebrow>Help &amp; Support</Eyebrow>
        </div>
        <h1 className="mt-4 font-[Fraunces] text-[2.4rem] font-semibold leading-[1.1] tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9] sm:text-[3rem]">
          What do you need to know?
        </h1>
        <p className="mt-5 max-w-[42rem] font-[DM_Sans] text-lg leading-relaxed text-[#4B5563] dark:text-[#94A3B8]">
          You sell a house a handful of times in a lifetime; the industry does
          it every day and rarely stops to explain itself. {guideCount} plain-English
          guides to an England and Wales move, grouped by where you are. Pick a
          section, or scroll.
        </p>

        <div className="mt-8">
          <SectionPills label="Jump to a section" mode="anchor" />
        </div>

        <div className="mt-14">
          {categories.map((c, i) => (
            <CategorySection key={c.slug} category={c} index={i} />
          ))}
        </div>

        <p className="mt-4 border-t border-[#E5E7EB] pt-8 font-[DM_Sans] text-base text-[#6B7280] dark:border-[#1E293B] dark:text-[#94A3B8]">
          More sections are coming: probate and inherited property, auction,
          and the reform agenda. Looking for what it costs? See{' '}
          <Link to="/pricing" className="font-medium text-[#0F766E] underline decoration-[#0F766E]/40 underline-offset-[3px] hover:decoration-[#0F766E] dark:text-[#2DD4BF]">
            pricing
          </Link>
          .
        </p>

        <div className="mt-12">
          <StillNeedHelp />
        </div>
      </main>
    </MarketingShell>
  );
};

export default ResourcesHubPage;
