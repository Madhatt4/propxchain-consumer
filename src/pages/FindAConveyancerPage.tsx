// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import React from 'react';
import { Link } from 'react-router-dom';
import MarketingShell from './marketing/MarketingShell';

/**
 * The React page behind /find-a-conveyancer.
 *
 * Prerendered for crawlers by scripts/prerender-marketing.mjs and joint-highest
 * priority in sitemap.xml (0.95). Like /sell-my-house it had no matching
 * <Route> from the 2026-06-13 BrowserRouter migration until 2026-08-06, so
 * humans arriving from search were bounced to home by NotFoundRedirect.
 *
 * Content mirrors the prerendered fallback — a crawler and a human must be
 * promised the same thing. src/router/__tests__/marketingRouteParity.test.ts
 * guards the route's existence.
 */

interface Reason {
  lead: string;
  body: string;
}

const reasons: Reason[] = [
  {
    lead: 'A quote on the real work',
    body: 'Conveyancers quote your actual transaction, not a one-size-fits-all rate padded for unknown risk. No hourly billing, no surprise invoices.',
  },
  {
    lead: 'CLC-verified only',
    body: 'Every firm is checked against the Council for Licensed Conveyancers register before joining the panel.',
  },
  {
    lead: 'Online-first',
    body: 'Everything runs inside PropXchain. No courier dance, no faxed redemption statements, no missed calls.',
  },
  {
    lead: 'Shared live view',
    body: 'Your conveyancer sees the same transaction you see, and both sides see the same progress. No chasing.',
  },
  {
    lead: 'Blockchain audit trail',
    body: 'Every action is timestamped on the Internet Computer. If anything is ever disputed, the record is cryptographically verifiable.',
  },
];

const steps: string[] = [
  'Create a PropXchain account — free, and no password if you use Internet Identity.',
  'Start or join a transaction, whether you are buying or selling.',
  'Browse the panel and compare quotes — filter by region, response time and specialisation.',
  'Appoint in one click. Your conveyancer gets the shared workspace and pulls your documents automatically.',
  'Pay your conveyancer direct, at the price they quoted. PropXchain never takes a cut.',
];

interface Faq {
  question: string;
  answer: string;
}

const faqs: Faq[] = [
  {
    question: 'Is an online conveyancer as good as a high-street one?',
    answer:
      'Yes — the legal work is identical, and CLC verification is the same regulator that licenses high-street firms. Online firms are often faster because they do not duplicate work the platform already handles.',
  },
  {
    question: 'Can I use my own conveyancer instead of the panel?',
    answer:
      'You can invite your existing solicitor to the transaction and they will see the same shared view. Panel quotes apply only if you choose from the panel.',
  },
  {
    question: 'What does the conveyancer’s quote cover?',
    answer:
      'The reserved legal acts only a licensed conveyancer can perform: exchange of contracts, transfer of title, and completion. Everything else — searches, forms, document handling — is managed by you inside PropXchain, which is why quotes are often tighter than high-street rates.',
  },
];

const FindAConveyancerPage: React.FC = () => {
  return (
    <MarketingShell>
      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[760px] px-6 py-16 sm:py-24">
        <h1 className="font-[Fraunces] text-[2.5rem] font-semibold leading-[1.05] tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9] sm:text-[3.5rem]">
          Find a conveyancer — quoted on your actual transaction.
        </h1>
        <p className="mt-6 max-w-xl font-[DM_Sans] text-lg leading-relaxed text-[#6B7280] dark:text-[#94A3B8]">
          Every conveyancer on the panel is CLC-verified, quotes you directly
          with no PropXchain markup, and works from the same live transaction
          view you do.
        </p>
      </section>

      {/* ── Why ─────────────────────────────────────────────────── */}
      <section className="border-t border-[#E5E7EB] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#0F172A]">
        <div className="mx-auto max-w-[760px] px-6 py-20">
          <h2 className="font-[Fraunces] text-[1.75rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9]">
            Why use a PropXchain conveyancer
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
            How to find and appoint a conveyancer
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
            Finding a conveyancer — questions
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
            Ready to find a conveyancer?
          </h2>
          <p className="mt-3 font-[DM_Sans] text-base text-[#6B7280] dark:text-[#94A3B8]">
            Create a free account and compare quotes on your real transaction.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex min-h-12 items-center justify-center rounded-md bg-[#0D9488] px-8 py-3 font-[DM_Sans] text-base font-medium text-white transition-colors hover:bg-[#0F766E]"
            >
              Create a free account
            </Link>
            <Link
              to="/sell-my-house"
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-[#0D9488] dark:border-[#14B8A6] px-8 py-3 font-[DM_Sans] text-base font-medium text-[#0D9488] dark:text-[#14B8A6] hover:bg-[#0D9488] dark:hover:bg-[#14B8A6] hover:text-white"
            >
              Selling a house?
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
};

export default FindAConveyancerPage;
