// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import { Link } from 'react-router-dom';
import MarketingShell from './marketing/MarketingShell';

interface Feature {
  title: string;
  body: string;
  bullets: [string, string];
}

const features: Feature[] = [
  {
    title: 'AI co-pilot for the whole transaction',
    body:
      'The optional £75 Premium co-pilot reads your HM Land Registry title and your search results in plain English, flags the issues that actually matter, and turns the real complexity of your transaction into a tailored conveyancer quote request — so you often get a tighter quote. Next-step cards guide each stage. No chatbot theatrics.',
    bullets: [
      'Plain-English summaries of your title and searches, issues flagged',
      'Complexity-aware quote request that gets you better conveyancer prices',
    ],
  },
  {
    title: 'Verifiable on-chain audit trail',
    body:
      'Every material change — offer accepted, searches ordered, contract signed — is written to the Internet Computer as a timestamped event. Anyone you share the link with can verify the history without trusting us.',
    bullets: [
      'Tamper-proof timeline on UK regulated infrastructure',
      'Public ledger view linkable to your buyer, lender, or solicitor',
    ],
  },
  {
    title: 'Tamper-proof documents and login',
    body:
      'Documents are hashed and timestamped on upload. Login uses Internet Identity passkeys or email — your choice — with no shared password to leak.',
    bullets: [
      'Document version history you can prove',
      'Passkey or email auth, never both required',
    ],
  },
  {
    title: 'Six-phase guided wizard',
    body:
      'A single flow that walks you through property details, TA6 / TA10 forms, ID and AML, financial terms, contract generation, and exchange. Save and return at any step.',
    bullets: [
      'TA6 and TA10 built in, no separate PDFs',
      'Resume from any device — your progress is on-chain',
    ],
  },
];

const FeaturesPage: React.FC = () => {
  return (
    <MarketingShell>
      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[760px] px-6 py-16 sm:py-24">
        <h1 className="font-[Fraunces] text-[2.5rem] font-semibold leading-[1.05] tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9] sm:text-[3.5rem]">
          Everything you need for a modern conveyancing transaction.
        </h1>
        <p className="mt-6 max-w-xl font-[DM_Sans] text-lg leading-relaxed text-[#6B7280] dark:text-[#94A3B8]">
          Four capabilities do most of the work. The rest of the platform is
          quiet plumbing — there when you need it, invisible when you don't.
        </p>
      </section>

      {/* ── Feature stack — long-form, no card grid ─────────────── */}
      <section className="border-t border-[#E5E7EB] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#0F172A]">
        <div className="mx-auto max-w-[760px] px-6 py-20">
          <div className="space-y-16">
            {features.map((feature) => (
              <div key={feature.title}>
                <h2 className="font-[Fraunces] text-[1.75rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9]">
                  {feature.title}
                </h2>
                <p className="mt-4 font-[DM_Sans] text-base leading-relaxed text-[#1A1A1A] dark:text-[#CBD5E1]">
                  {feature.body}
                </p>
                <ul className="mt-5 space-y-2 font-[DM_Sans] text-sm text-[#5F8A68] dark:text-[#6EE7B7]">
                  {feature.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2">
                      <span className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-[#5F8A68] dark:bg-[#6EE7B7]" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA — modest, MarketingShell style ───────────── */}
      <section className="border-t border-[#E5E7EB] dark:border-[#1E293B] bg-[#F0F5F0] dark:bg-[#0D1526]">
        <div className="mx-auto max-w-[760px] px-6 py-16 text-center">
          <h2 className="font-[Fraunces] text-2xl font-semibold tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9]">
            See it move.
          </h2>
          <p className="mt-3 font-[DM_Sans] text-base text-[#6B7280] dark:text-[#94A3B8]">
            A walk through how a transaction actually progresses, end to end.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link
              to="/how-it-works"
              className="inline-flex min-h-12 items-center justify-center rounded-md bg-[#0D9488] px-8 py-3 font-[DM_Sans] text-base font-medium text-white transition-colors hover:bg-[#0F766E]"
            >
              How it works
            </Link>
            <Link
              to="/sellers"
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-[#0D9488] dark:border-[#14B8A6] px-8 py-3 font-[DM_Sans] text-base font-medium text-[#0D9488] dark:text-[#14B8A6] hover:bg-[#0D9488] dark:hover:bg-[#14B8A6] hover:text-white"
            >
              For sellers
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
};

export default FeaturesPage;
