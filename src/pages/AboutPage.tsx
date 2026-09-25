// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import { Link } from 'react-router-dom';
import MarketingShell from './marketing/MarketingShell';

const AboutPage: React.FC = () => {
  return (
    <MarketingShell>
      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[760px] px-6 py-16 sm:py-24">
        <h1 className="font-[Fraunces] text-[2.5rem] font-semibold leading-[1.05] tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9] sm:text-[3.5rem]">
          Why we built PropXchain.
        </h1>
        <p className="mt-6 max-w-xl font-[DM_Sans] text-lg leading-relaxed text-[#6B7280] dark:text-[#94A3B8]">
          UK property transactions take four to five months on average. They
          fall through one in three times. Most of the delay is people waiting
          for someone else to send the same information again. We thought we
          could do better than that.
        </p>
      </section>

      {/* ── Mission — three lines, not six bullets ───────────────── */}
      <section className="border-t border-[#E5E7EB] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#0F172A]">
        <div className="mx-auto max-w-[760px] px-6 py-20">
          <h2 className="font-[Fraunces] text-[1.75rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9]">
            What we are trying to do.
          </h2>
          <div className="mt-6 space-y-5 font-[DM_Sans] text-base leading-relaxed text-[#1A1A1A] dark:text-[#CBD5E1]">
            <p>
              <span className="font-medium text-[#5F8A68] dark:text-[#6EE7B7]">Faster.</span>{' '}
              Take weeks out of the timeline by removing the steps where someone
              has to chase, retype, or re-send.
            </p>
            <p>
              <span className="font-medium text-[#5F8A68] dark:text-[#6EE7B7]">Transparent.</span>{' '}
              Every party sees the same record, in real time, with the history
              of how it got there.
            </p>
            <p>
              <span className="font-medium text-[#5F8A68] dark:text-[#6EE7B7]">Honest about cost.</span>{' '}
              Consumer-direct: you pick your own providers and see every price up front, with
              no success fees and no tied conveyancer. Starting is free — an
              optional £75 AI co-pilot is the only thing we charge for.
            </p>
          </div>
        </div>
      </section>

      {/* ── Why the Internet Computer ────────────────────────────── */}
      <section className="border-t border-[#E5E7EB] dark:border-[#1E293B] bg-[#FAFAF8] dark:bg-[#0B1120]">
        <div className="mx-auto max-w-[760px] px-6 py-20">
          <h2 className="font-[Fraunces] text-[1.75rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9]">
            Why the Internet Computer.
          </h2>
          <div className="mt-6 space-y-5 font-[DM_Sans] text-base leading-relaxed text-[#1A1A1A] dark:text-[#CBD5E1]">
            <p>
              The audit trail of a property transaction needs to outlive the
              company that hosted it. We use the Internet Computer because it
              gives us a public, timestamped record that survives us — and
              because it lets the platform run as code rather than as a server
              someone could quietly edit.
            </p>
            <p className="text-[#5F8A68] dark:text-[#6EE7B7]">
              You do not need to understand any of this to use PropXchain. It
              is there when you need to prove what happened.
            </p>
          </div>
        </div>
      </section>

      {/* ── Founder note ─────────────────────────────────────────── */}
      <section className="border-t border-[#E5E7EB] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#0F172A]">
        <div className="mx-auto max-w-[760px] px-6 py-20">
          <h2 className="font-[Fraunces] text-[1.75rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9]">
            Who is behind this.
          </h2>
          <div className="mt-6 space-y-5 font-[DM_Sans] text-base leading-relaxed text-[#1A1A1A] dark:text-[#CBD5E1]">
            <p>
              PropXchain Ltd is registered in England, Companies House number
              17018978, based in Sandy, Bedfordshire. The product is built by
              Marc Hatton, who has spent the last thirty years inside retail
              and business development and has had two of his own house moves
              fall through the chain.
            </p>
            <p>
              You can reach us at{' '}
              <a
                href="mailto:info@propxchain.com"
                className="text-[#0D9488] dark:text-[#14B8A6] hover:underline"
              >
                info@propxchain.com
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────── */}
      <section className="border-t border-[#E5E7EB] dark:border-[#1E293B] bg-[#F0F5F0] dark:bg-[#0D1526]">
        <div className="mx-auto max-w-[760px] px-6 py-16 text-center">
          <h2 className="font-[Fraunces] text-2xl font-semibold tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9]">
            Find your path in.
          </h2>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link
              to="/sellers"
              className="inline-flex min-h-12 items-center justify-center rounded-md bg-[#0D9488] px-8 py-3 font-[DM_Sans] text-base font-medium text-white transition-colors hover:bg-[#0F766E]"
            >
              For sellers
            </Link>
            <Link
              to="/developers"
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-[#0D9488] dark:border-[#14B8A6] px-8 py-3 font-[DM_Sans] text-base font-medium text-[#0D9488] dark:text-[#14B8A6] hover:bg-[#0D9488] dark:hover:bg-[#14B8A6] hover:text-white"
            >
              For housebuilders
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
};

export default AboutPage;
