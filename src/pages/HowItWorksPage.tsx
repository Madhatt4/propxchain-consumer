// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import { Link } from 'react-router-dom';
import MarketingShell from './marketing/MarketingShell';

interface Step {
  number: number;
  title: string;
  body: string;
}

const steps: Step[] = [
  {
    number: 1,
    title: 'Create your account',
    body:
      'Sign in with email and a password, or with an Internet Identity passkey. Either way works — pick whichever fits how you already log in elsewhere.',
  },
  {
    number: 2,
    title: 'Start the transaction',
    body:
      'Open the property wizard, choose sale or purchase, and enter the address. Hit the Title button in the property listing section to check who owns YOUR property — £7 pulls the official HM Land Registry record, and it names the registered owner.',
  },
  {
    number: 3,
    title: 'Complete the property forms',
    body:
      'Work through TA6 and TA10 with inline help. Save and come back. Every field is plain English, with the option to see the legal phrasing if you want it.',
  },
  {
    number: 4,
    title: 'Upload supporting documents',
    body:
      'ID, proof of address, proof of funds. Each upload is hashed and timestamped — you and the other side can prove what was sent and when.',
  },
  {
    number: 5,
    title: 'Collaborate with the other parties',
    body:
      'Buyer, seller, and conveyancer all see the same record. Status changes, document requests, and questions live in one place rather than scattered emails.',
  },
  {
    number: 6,
    title: 'Exchange and complete',
    body:
      'Contracts are signed digitally, the exchange is recorded on the public ledger, and completion releases funds. The full history stays linkable for as long as you need it.',
  },
];

const HowItWorksPage: React.FC = () => {
  return (
    <MarketingShell>
      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[760px] px-6 py-16 sm:py-24">
        <h1 className="font-[Fraunces] text-[2.5rem] font-semibold leading-[1.05] tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9] sm:text-[3.5rem]">
          How a transaction moves through PropXchain.
        </h1>
        <p className="mt-6 max-w-xl font-[DM_Sans] text-lg leading-relaxed text-[#6B7280] dark:text-[#94A3B8]">
          Six steps from account to completion. Each one saves where you left
          off and is visible to every party in the chain.
        </p>
      </section>

      {/* ── Step list — single column, generous spacing ─────────── */}
      <section className="border-t border-[#E5E7EB] dark:border-[#1E293B] bg-[#FFFFFF] dark:bg-[#0F172A]">
        <div className="mx-auto max-w-[760px] px-6 py-20">
          <ol className="space-y-12">
            {steps.map((step) => (
              <li key={step.number} className="flex gap-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-[#0D9488] dark:border-[#14B8A6] font-[DM_Sans] text-base font-semibold text-[#0D9488] dark:text-[#14B8A6]">
                  {step.number}
                </div>
                <div className="flex-1">
                  <h2 className="font-[Fraunces] text-xl font-semibold leading-tight tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9]">
                    {step.title}
                  </h2>
                  <p className="mt-3 font-[DM_Sans] text-base leading-relaxed text-[#1A1A1A] dark:text-[#CBD5E1]">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────── */}
      <section className="border-t border-[#E5E7EB] dark:border-[#1E293B] bg-[#F0F5F0] dark:bg-[#0D1526]">
        <div className="mx-auto max-w-[760px] px-6 py-16 text-center">
          <h2 className="font-[Fraunces] text-2xl font-semibold tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9]">
            Ready to start?
          </h2>
          <p className="mt-3 font-[DM_Sans] text-base text-[#6B7280] dark:text-[#94A3B8]">
            Whether you are selling, buying, or building, the first step is the
            same.
          </p>
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

export default HowItWorksPage;
