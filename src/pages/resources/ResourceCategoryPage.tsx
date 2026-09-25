// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Pillar page for one Help & Support section: /resources/<category>.
 * Lists the section's published guides as bordered rows, offers the
 * other live sections as pills, and links back up to the hub. Only
 * categories with published articles have routes (see App.tsx), so this
 * component never renders an empty section.
 */

import React, { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import MarketingShell from '../marketing/MarketingShell';
import { liveCategories, publishedInCategory } from './resourcesMeta';
import {
  ArticleRowList,
  HelpBreadcrumb,
  SectionPills,
  StillNeedHelp,
} from './helpElements';

const NotFound: React.FC = () => (
  <MarketingShell>
    <main className="mx-auto max-w-[720px] px-6 pb-24 pt-16">
      <HelpBreadcrumb />
      <h1 className="mt-5 font-[Fraunces] text-3xl font-semibold text-[#1A1A1A] dark:text-[#F1F5F9]">
        Section not found
      </h1>
      <p className="mt-4 font-[DM_Sans] text-base text-[#4B5563] dark:text-[#94A3B8]">
        Nothing is published here yet. These sections are live:
      </p>
      <div className="mt-6">
        <SectionPills label="Live sections" mode="route" />
      </div>
    </main>
  </MarketingShell>
);

const ResourceCategoryPage: React.FC = () => {
  const { category = '' } = useParams();
  const match = liveCategories().find((c) => c.slug === category);

  useEffect(() => {
    document.title = match
      ? `${match.name} Guides · Help & Support · PropXchain`
      : 'Help & Support · PropXchain';
    window.scrollTo(0, 0);
  }, [match]);

  if (!match) return <NotFound />;

  const articles = publishedInCategory(match.slug);

  return (
    <MarketingShell>
      <main className="mx-auto max-w-[1040px] px-6 pb-24 pt-16 sm:pt-20">
        <HelpBreadcrumb />
        <h1 className="mt-5 font-[Fraunces] text-[2.4rem] font-semibold leading-[1.1] tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9] sm:text-[3rem]">
          {match.name}
        </h1>
        <p className="mt-5 max-w-[42rem] font-[DM_Sans] text-lg leading-relaxed text-[#4B5563] dark:text-[#94A3B8]">
          {match.description}
        </p>

        <div className="mt-8">
          <SectionPills label="Other sections" mode="route" current={match.slug} />
        </div>

        <div className="mt-12">
          <ArticleRowList articles={articles} ariaLabel={`${match.name} guides`} />
        </div>

        <p className="mt-10 font-[DM_Sans] text-base text-[#6B7280] dark:text-[#94A3B8]">
          <Link
            to="/resources"
            className="inline-flex min-h-11 items-center font-medium text-[#0F766E] underline decoration-[#0F766E]/40 underline-offset-[3px] hover:decoration-[#0F766E] dark:text-[#2DD4BF]"
          >
            All Help &amp; Support guides
          </Link>
        </p>

        <div className="mt-12">
          <StillNeedHelp />
        </div>
      </main>
    </MarketingShell>
  );
};

export default ResourceCategoryPage;
