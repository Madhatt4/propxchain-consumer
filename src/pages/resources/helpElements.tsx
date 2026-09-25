// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Help & Support hub — navigation primitives shared by the hub, the
 * category pillars and the article layout. Every clickable thing here
 * looks clickable at rest (bordered row, arrow, tinted hover), not only
 * on hover: the audience skews older and reads on a phone, where hover
 * does not exist.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import {
  articlePath,
  liveCategories,
  type PublishedArticle,
  type ResourceCategory,
} from './resourcesMeta';

const ARROW = (
  <svg
    aria-hidden="true"
    viewBox="0 0 20 20"
    className="h-5 w-5 shrink-0 text-[#0F766E] transition-transform duration-200 ease-out group-hover:translate-x-1 motion-reduce:transition-none dark:text-[#2DD4BF]"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 10h12M11 5l5 5-5 5" />
  </svg>
);

const linkCls =
  'font-medium text-[#0F766E] underline decoration-[#0F766E]/40 underline-offset-[3px] hover:decoration-[#0F766E] dark:text-[#2DD4BF] dark:decoration-[#2DD4BF]/40 dark:hover:decoration-[#2DD4BF]';

/** Small mono eyebrow used above sections. */
export const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="flex items-center gap-2 font-[Geist_Mono] text-[0.68rem] uppercase tracking-[0.14em] text-[#0F766E] dark:text-[#2DD4BF]">
    <span aria-hidden="true" className="h-px w-[22px] bg-current" />
    {children}
  </p>
);

/**
 * One article as a full-width bordered row: title, teaser, reading time
 * and an arrow. The whole row is the link; the tint and the arrow shift
 * on hover and focus.
 */
export const ArticleRow: React.FC<{ article: PublishedArticle }> = ({ article }) => (
  <li>
    <Link
      to={articlePath(article)}
      className="group flex items-start gap-5 px-5 py-5 transition-colors duration-150 ease-out hover:bg-[#F0F5F0] focus-visible:bg-[#F0F5F0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0D9488] dark:hover:bg-[#0F1A2E] dark:focus-visible:bg-[#0F1A2E] sm:px-6"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-[Fraunces] text-[1.2rem] font-semibold leading-snug tracking-tight text-[#1A1A1A] underline decoration-[#DAE5DC] decoration-2 underline-offset-[5px] transition-colors group-hover:decoration-[#0D9488] dark:text-[#F1F5F9] dark:decoration-[#1E293B] dark:group-hover:decoration-[#2DD4BF]">
          {article.title}
        </span>
        <span className="mt-2 block max-w-[62ch] font-[DM_Sans] text-[0.95rem] leading-relaxed text-[#4B5563] dark:text-[#94A3B8]">
          {article.teaser}
        </span>
        <span className="mt-2.5 block font-[Geist_Mono] text-[0.65rem] uppercase tracking-[0.12em] text-[#6B7280] dark:text-[#64748B]">
          {article.readingTime}
        </span>
      </span>
      <span className="mt-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#DAE5DC] bg-white transition-colors group-hover:border-[#0D9488] dark:border-[#1E293B] dark:bg-[#0B1120] dark:group-hover:border-[#2DD4BF]">
        {ARROW}
      </span>
    </Link>
  </li>
);

/** Bordered list of article rows with rules between them. */
export const ArticleRowList: React.FC<{
  articles: PublishedArticle[];
  ariaLabel: string;
}> = ({ articles, ariaLabel }) => (
  <ul
    aria-label={ariaLabel}
    className="divide-y divide-[#E5E7EB] overflow-hidden rounded-xl border border-[#DAE5DC] bg-white dark:divide-[#1E293B] dark:border-[#1E293B] dark:bg-[#0B1120]"
  >
    {articles.map((a) => (
      <ArticleRow key={a.slug} article={a} />
    ))}
  </ul>
);

/**
 * Pill row naming every live section. On the hub the pills jump to the
 * section on the page; elsewhere they link to the pillar. `current` is
 * rendered as a static, filled pill.
 */
export const SectionPills: React.FC<{
  label: string;
  mode: 'anchor' | 'route';
  current?: ResourceCategory['slug'];
}> = ({ label, mode, current }) => (
  <nav aria-label={label}>
    <ul className="flex flex-wrap gap-2">
      {liveCategories().map((c) => {
        const isCurrent = c.slug === current;
        const base =
          'inline-flex min-h-11 items-center rounded-full border px-4 font-[DM_Sans] text-sm font-medium transition-colors duration-150 ease-out';
        if (isCurrent) {
          return (
            <li key={c.slug}>
              <span
                aria-current="page"
                className={`${base} border-[#0D9488] bg-[#0D9488] text-white dark:border-[#2DD4BF] dark:bg-[#2DD4BF] dark:text-[#0B1120]`}
              >
                {c.name}
              </span>
            </li>
          );
        }
        const cls = `${base} border-[#DAE5DC] bg-white text-[#1A1A1A] hover:border-[#0D9488] hover:bg-[#F0F5F0] dark:border-[#1E293B] dark:bg-[#0B1120] dark:text-[#E2E8F0] dark:hover:border-[#2DD4BF] dark:hover:bg-[#0F1A2E]`;
        return (
          <li key={c.slug}>
            {mode === 'anchor' ? (
              <a href={`#cat-${c.slug}`} className={cls}>
                {c.name}
              </a>
            ) : (
              <Link to={`/resources/${c.slug}`} className={cls}>
                {c.name}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  </nav>
);

/** Breadcrumb trail: Home / Help & Support [/ Section]. */
export const HelpBreadcrumb: React.FC<{ category?: ResourceCategory }> = ({ category }) => {
  const item = 'transition-colors hover:text-[#0D9488] dark:hover:text-[#2DD4BF]';
  return (
    <nav aria-label="Breadcrumb" className="font-[Geist_Mono] text-[0.68rem] uppercase tracking-[0.14em]">
      <ol className="flex flex-wrap items-center">
        <li>
          <Link to="/" className={`${item} text-[#6B7280] dark:text-[#94A3B8]`}>Home</Link>
        </li>
        <li aria-hidden="true" className="mx-2 text-[#6B7280] dark:text-[#64748B]">/</li>
        <li>
          <Link to="/resources" className={`${item} text-[#5F8A68] dark:text-[#6EE7B7]`}>
            Help &amp; Support
          </Link>
        </li>
        {category && (
          <>
            <li aria-hidden="true" className="mx-2 text-[#6B7280] dark:text-[#64748B]">/</li>
            <li>
              <Link to={`/resources/${category.slug}`} className={`${item} text-[#5F8A68] dark:text-[#6EE7B7]`}>
                {category.name}
              </Link>
            </li>
          </>
        )}
      </ol>
    </nav>
  );
};

/**
 * "Still need help?" band. Three routes out: the FAQ, the contact form,
 * and email. Sits at the foot of every Help & Support page so nobody
 * hits the end of a guide with nowhere to go.
 */
export const StillNeedHelp: React.FC = () => (
  <section
    aria-labelledby="still-need-help"
    className="rounded-xl border border-[#DAE5DC] bg-[#F0F5F0] px-6 py-8 dark:border-[#1E293B] dark:bg-[#0D1526] sm:px-8"
  >
    <h2 id="still-need-help" className="font-[Fraunces] text-[1.5rem] font-semibold tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9]">
      Still need help?
    </h2>
    <p className="mt-2 max-w-[52ch] font-[DM_Sans] text-base leading-relaxed text-[#4B5563] dark:text-[#94A3B8]">
      Short answers on cost, who does the legal work and what goes on the
      blockchain are in the FAQ. For anything else, a person replies within
      one working day.
    </p>
    <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
      <Link
        to="/faq"
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#0D9488] px-6 font-[DM_Sans] text-base font-bold text-white transition-colors hover:bg-[#0F766E]"
      >
        Read the FAQ
      </Link>
      <Link
        to="/support"
        className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#0D9488] px-6 font-[DM_Sans] text-base font-bold text-[#0F766E] transition-colors hover:bg-[#0D9488] hover:text-white dark:border-[#2DD4BF] dark:text-[#2DD4BF] dark:hover:bg-[#2DD4BF] dark:hover:text-[#0B1120]"
      >
        Contact support
      </Link>
      <a href="mailto:info@propxchain.com" className={`font-[DM_Sans] text-sm ${linkCls}`}>
        info@propxchain.com
      </a>
    </div>
  </section>
);
