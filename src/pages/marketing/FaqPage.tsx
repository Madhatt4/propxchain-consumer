// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * /faq — grouped FAQ for the marketing site.
 *
 * Content and the FAQPage JSON-LD both come from faqData.mjs (single
 * source of truth, shared with scripts/prerender-marketing.mjs). Bots
 * read the fully-expanded prerendered dist/faq/index.html; humans get
 * this accordion version.
 *
 * DESIGN.md compliance: Fraunces headings, DM Sans body, teal CTAs,
 * sage accents, light #FAFAF8 / dark #0B1120, no blue.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import MarketingShell from './MarketingShell';
import { FAQ_GROUPS, buildFaqJsonLd, type FaqGroup, type FaqItem } from './faqData';

const FaqEntry: React.FC<{ item: FaqItem }> = ({ item }) => (
  <details className="group">
    <summary className="flex cursor-pointer list-none items-baseline justify-between gap-6 py-4 font-[DM_Sans] text-base font-medium text-[#1A1A1A] transition-colors hover:text-[#0D9488] dark:text-[#F1F5F9] dark:hover:text-[#6EE7B7] [&::-webkit-details-marker]:hidden">
      <span>{item.q}</span>
      <span
        aria-hidden="true"
        className="shrink-0 select-none text-lg font-normal leading-none text-[#5F8A68] transition-transform duration-200 ease-out group-open:rotate-45 dark:text-[#6EE7B7]"
      >
        +
      </span>
    </summary>
    <p className="max-w-[65ch] pb-5 pr-8 font-[DM_Sans] text-[0.9375rem] leading-relaxed text-[#6B7280] dark:text-[#94A3B8]">
      {item.a}
    </p>
  </details>
);

const FaqGroupSection: React.FC<{ group: FaqGroup; index: number }> = ({ group, index }) => (
  <section
    aria-labelledby={group.id}
    className="grid gap-x-16 gap-y-4 border-t border-[#E5E7EB] py-12 first:border-t-0 first:pt-0 dark:border-[#1E293B] md:grid-cols-[240px_1fr]"
  >
    <div>
      <div className="md:sticky md:top-10">
        <p className="font-[DM_Sans] text-xs font-medium uppercase tracking-[0.14em] text-[#5F8A68] dark:text-[#6EE7B7]">
          {String(index + 1).padStart(2, '0')}
        </p>
        <h2
          id={group.id}
          className="mt-2 font-[Fraunces] text-[1.6rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9]"
        >
          {group.title}
        </h2>
      </div>
    </div>
    <div className="divide-y divide-[#E5E7EB] dark:divide-[#1E293B]">
      {group.items.map((item) => (
        <FaqEntry key={item.q} item={item} />
      ))}
    </div>
  </section>
);

const FaqPage: React.FC = () => {
  return (
    <MarketingShell>
      {/* FAQPage structured data — mirrors the prerendered head block */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildFaqJsonLd()).replace(/</g, '\\u003C'),
        }}
      />

      {/* Hero */}
      <section className="mx-auto max-w-[1040px] px-6 pb-16 pt-20 sm:pt-28">
        <h1 className="font-[Fraunces] text-[2.5rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9] sm:text-[3rem]">
          Questions, answered straight.
        </h1>
        <p className="mt-6 max-w-2xl font-[DM_Sans] text-lg text-[#6B7280] dark:text-[#94A3B8]">
          Selling, buying and completing on PropXchain — what it costs, who
          does the legal work, and what actually goes on the blockchain.
        </p>
      </section>

      {/* Grouped Q&As */}
      <section className="mx-auto max-w-[1040px] px-6 pb-20">
        {FAQ_GROUPS.map((group, index) => (
          <FaqGroupSection key={group.id} group={group} index={index} />
        ))}
      </section>

      {/* Closing band */}
      <section className="border-t border-[#E5E7EB] bg-[#F0F5F0] dark:border-[#1E293B] dark:bg-[#0D1526]">
        <div className="mx-auto max-w-[760px] px-6 py-16 text-center">
          <h2 className="font-[Fraunces] text-[1.75rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9]">
            Still curious?
          </h2>
          <p className="mx-auto mt-3 max-w-xl font-[DM_Sans] text-sm text-[#6B7280] dark:text-[#94A3B8]">
            Starter is free and takes two minutes to set up — or ask us
            anything first.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#0D9488] px-6 py-3 font-[DM_Sans] text-sm font-medium text-white transition-colors hover:bg-[#0F766E]"
            >
              Start free
            </Link>
            <Link
              to="/support"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#0D9488] dark:border-[#14B8A6] px-6 py-3 font-[DM_Sans] text-sm font-medium text-[#0D9488] dark:text-[#14B8A6] transition-colors hover:bg-[#0D9488] dark:hover:bg-[#14B8A6] hover:text-white"
            >
              Talk to us
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
};

export default FaqPage;
