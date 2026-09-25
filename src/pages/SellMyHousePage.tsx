// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import React from 'react';
import { Link } from 'react-router-dom';
import MarketingShell from './marketing/MarketingShell';

/**
 * The React page behind /sell-my-house.
 *
 * This route is prerendered for crawlers by scripts/prerender-marketing.mjs and
 * carries the highest priority in sitemap.xml (0.95). It had no matching
 * <Route> from the 2026-06-13 BrowserRouter migration until 2026-08-06, so
 * every human who clicked the Google result — or one of the internal links from
 * the guides pages — was bounced to home by NotFoundRedirect.
 *
 * Content deliberately mirrors the prerendered fallback: a crawler and a human
 * must be promised the same thing. src/router/__tests__/marketingRouteParity.test.ts
 * guards the route's existence; keeping the copy in step is a human job.
 */

interface Reason {
  lead: string;
  body: string;
}

const reasons: Reason[] = [
  {
    lead: 'Free to start',
    body: 'No platform fee, no monthly fees, no listing fees. Add the optional £75 AI co-pilot whenever you like.',
  },
  {
    lead: 'Save £2,000+ vs traditional',
    body: 'A typical UK sale costs £1,500–£2,500 in agent and conveyancing admin fees. PropXchain cuts the admin middleman.',
  },
  {
    lead: 'Weeks, not months',
    body: 'UK conveyancing averages 20–24 weeks. PropXchain sellers complete faster because everyone sees the same live transaction.',
  },
  {
    lead: 'You stay in control',
    body: 'Order your own searches, invite your own buyer, pick your own CLC-verified conveyancer from the panel.',
  },
  {
    lead: 'Blockchain-backed audit trail',
    body: 'Every milestone is timestamped on the Internet Computer, verifiable by buyer, lender and regulator.',
  },
];

const steps: string[] = [
  'List your house — add the address, then hit the Title button to check who owns YOUR property: £7 for the official HM Land Registry record.',
  'Complete the TA6 and TA10 forms with guidance. Save progress and come back anytime.',
  'Invite your buyer — or let us match you. The buyer uses PropXchain free.',
  'Order searches directly — local authority, drainage, environmental. No solicitor markup.',
  'Appoint a conveyancer from the CLC-verified panel — quoted directly, never marked up.',
  'Exchange and complete with qualified electronic signatures and regulated escrow.',
];

interface Faq {
  question: string;
  answer: string;
}

const faqs: Faq[] = [
  {
    question: 'How much does it cost to sell my house with PropXchain?',
    answer:
      'Free to start — no platform fee. You pay roughly £50–£450 for searches (bought through PropXchain) and your conveyancer’s quoted fee. The optional AI co-pilot is £75 per transaction. No estate agent fee.',
  },
  {
    question: 'Do I need an estate agent?',
    answer:
      'No. PropXchain is seller-led — you manage the listing, the buyer communication and the progress. If you already have a buyer, it is the fastest and cheapest way to complete.',
  },
  {
    question: 'How long does it take to sell a house online?',
    answer:
      'With a willing buyer and both sides using PropXchain, completions routinely happen in 4–8 weeks rather than the UK average of 20+.',
  },
];

const SellMyHousePage: React.FC = () => {
  return (
    <MarketingShell>
      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[760px] px-6 py-16 sm:py-24">
        <h1 className="font-[Fraunces] text-[2.5rem] font-semibold leading-[1.05] tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9] sm:text-[3.5rem]">
          Sell your house online — free to start.
        </h1>
        <p className="mt-6 max-w-xl font-[DM_Sans] text-lg leading-relaxed text-[#6B7280] dark:text-[#94A3B8]">
          The simple, fast way to sell your house in the UK. No platform fee, no
          estate agent, no hidden markup.
        </p>
      </section>

      {/* ── Why ─────────────────────────────────────────────────── */}
      <section className="border-t border-[#E5E7EB] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#0F172A]">
        <div className="mx-auto max-w-[760px] px-6 py-20">
          <h2 className="font-[Fraunces] text-[1.75rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9]">
            Why sell your house with PropXchain
          </h2>
          <ul className="mt-8 space-y-6">
            {reasons.map((reason) => (
              <li key={reason.lead} className="flex items-start gap-3">
                <span className="mt-2.5 inline-block h-1 w-1 shrink-0 rounded-full bg-[#5F8A68] dark:bg-[#6EE7B7]" />
                <p className="font-[DM_Sans] text-base leading-relaxed text-[#1A1A1A] dark:text-[#CBD5E1]">
                  <strong className="font-semibold">{reason.lead}</strong> —{' '}
                  {reason.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── How ─────────────────────────────────────────────────── */}
      <section className="border-t border-[#E5E7EB] dark:border-[#1E293B]">
        <div className="mx-auto max-w-[760px] px-6 py-20">
          <h2 className="font-[Fraunces] text-[1.75rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9]">
            How to sell your house online
          </h2>
          <ol className="mt-8 space-y-5">
            {steps.map((step, index) => (
              <li key={step} className="flex items-start gap-4">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F0F5F0] font-[DM_Sans] text-sm font-medium text-[#5F8A68] dark:bg-[#0D1526] dark:text-[#6EE7B7]">
                  {index + 1}
                </span>
                <p className="font-[DM_Sans] text-base leading-relaxed text-[#1A1A1A] dark:text-[#CBD5E1]">
                  {step}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────── */}
      <section className="border-t border-[#E5E7EB] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#0F172A]">
        <div className="mx-auto max-w-[760px] px-6 py-20">
          <h2 className="font-[Fraunces] text-[1.75rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9]">
            Selling your house — questions
          </h2>
          <div className="mt-8 space-y-8">
            {faqs.map((faq) => (
              <div key={faq.question}>
                <h3 className="font-[DM_Sans] text-base font-semibold text-[#1A1A1A] dark:text-[#F1F5F9]">
                  {faq.question}
                </h3>
                <p className="mt-2 font-[DM_Sans] text-base leading-relaxed text-[#6B7280] dark:text-[#94A3B8]">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA ─────────────────────────────────────────── */}
      <section className="border-t border-[#E5E7EB] dark:border-[#1E293B] bg-[#F0F5F0] dark:bg-[#0D1526]">
        <div className="mx-auto max-w-[760px] px-6 py-16 text-center">
          <h2 className="font-[Fraunces] text-2xl font-semibold tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9]">
            Ready to sell your house?
          </h2>
          <p className="mt-3 font-[DM_Sans] text-base text-[#6B7280] dark:text-[#94A3B8]">
            Start your sale in two minutes. Free, with no platform fee.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex min-h-12 items-center justify-center rounded-md bg-[#0D9488] px-8 py-3 font-[DM_Sans] text-base font-medium text-white transition-colors hover:bg-[#0F766E]"
            >
              Start your sale free
            </Link>
            <Link
              to="/find-a-conveyancer"
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-[#0D9488] dark:border-[#14B8A6] px-8 py-3 font-[DM_Sans] text-base font-medium text-[#0D9488] dark:text-[#14B8A6] hover:bg-[#0D9488] dark:hover:bg-[#14B8A6] hover:text-white"
            >
              Find a conveyancer
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
};

export default SellMyHousePage;
