// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * PricingPage (/pricing) — the actual PropXchain model (Marc, 2026-10-15).
 *
 *  - Using PropXchain is FREE for every party. No plans, no tiers, no
 *    platform fee.
 *  - Third-party items are paid per item, priced when you order: searches,
 *    ID & AML checks, the £7 HM Land Registry title pull, the £25
 *    property-chain check. Conveyancers quote you directly.
 *
 * Searches are sold with a margin, so this page must never claim "at cost",
 * "no mark-up" or "pass-through" (src/__tests__/pricingClaims.test.ts).
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { IS_REGISTRATION_OPEN, PRELAUNCH_CAPTURE_PATH } from '../config/registration';
import { FREE_FEATURES, PAID_ITEMS } from '../constants/pricing';

const FAQS = [
  {
    q: 'Is PropXchain really free?',
    a: 'Yes. Using PropXchain is free for buyers and sellers. There are no plans, no tiers and no platform fee.',
  },
  {
    q: 'So what do I pay for?',
    a: 'Only the third-party items you choose to order: property searches, ID and AML checks, the £7 HM Land Registry title pull and the £25 property chain check. Each one is priced when you order, before you pay.',
  },
  {
    q: 'What about solicitor/conveyancer fees?',
    a: 'The conveyancer quotes you directly for your transaction. You compare and choose from the panel, or invite your own.',
  },
  {
    q: 'Will it always be free?',
    a: 'Everything on PropXchain is free today. We may add paid extras later. If we do, you will see the price before you pay.',
  },
];

const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFAF8] via-white to-[#F0F5F0] dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 px-4 py-10 sm:px-6 lg:px-8">
      {/* /pricing is a PUBLIC page — it is where people arrive from search and
          shared links. It offered every visitor "Back to Dashboard", including
          those with no account, sending them to a dashboard that would bounce
          them to /login. Send signed-out visitors home instead. */}
      <button
        onClick={() => navigate(isAuthenticated ? '/dashboard' : '/')}
        className="mb-8 flex min-h-11 items-center gap-2 rounded-lg bg-black/5 dark:bg-white/10 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 transition-colors hover:bg-black/10 dark:hover:bg-white/20 hover:text-slate-900 dark:hover:text-slate-200"
      >
        &larr; {isAuthenticated ? 'Back to Dashboard' : 'Back to home'}
      </button>

      {/* Hero */}
      <div className="mx-auto max-w-2xl text-center mb-12">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50 sm:text-4xl lg:text-5xl mb-4">
          PropXchain is free to use.
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          No plans, no tiers, no platform fee. You only pay for the third-party items you
          order, and each one is priced when you order it.
        </p>
      </div>

      {/* Free to use */}
      <div className="mx-auto max-w-2xl rounded-2xl border border-blue-600/40 bg-white dark:bg-slate-800/70 p-8 shadow-lg shadow-blue-600/10">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Free to use</h2>
        <div className="mt-4 mb-6">
          <span className="text-5xl font-bold text-slate-900 dark:text-slate-50">Free</span>
          <span className="ml-2 text-sm text-slate-600 dark:text-slate-400">for buyers and sellers</span>
        </div>
        <ul className="space-y-3 mb-8">
          {FREE_FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-400 text-xs">
                &#10003;
              </span>
              {feature}
            </li>
          ))}
        </ul>
        {/* While sign-ups are closed /register shows "Sign-ups open at launch",
            so route to the capture path — the one consumer journey that IS
            open — and say so. */}
        <button
          onClick={() => navigate(IS_REGISTRATION_OPEN ? '/register' : PRELAUNCH_CAPTURE_PATH)}
          className="w-full rounded-xl bg-blue-600 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-700"
        >
          {IS_REGISTRATION_OPEN ? 'Start free' : 'Get the free Home Mover Report'}
        </button>
      </div>

      {/* Paid per item */}
      <div className="mx-auto mt-16 max-w-3xl">
        <h2 className="mb-6 text-center text-2xl font-bold text-slate-900 dark:text-slate-50">
          Paid per item
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {PAID_ITEMS.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-5 text-center"
            >
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.label}</p>
              <p className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-50">{item.cost}</p>
              <p className="mt-1 text-xs text-slate-500">{item.note}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-sm text-slate-500">
          You only pay for what you order, and you see the price before you pay.
        </p>
      </div>

      {/* FAQ */}
      <div className="mx-auto mt-16 max-w-2xl">
        <h2 className="mb-8 text-center text-2xl font-bold text-slate-900 dark:text-slate-50">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {FAQS.map((faq) => (
            <div
              key={faq.q}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 px-6 py-5"
            >
              <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-2">
                {faq.q}
              </h3>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="mx-auto mt-16 max-w-2xl rounded-2xl bg-blue-600/10 border border-blue-600/20 p-10 text-center">
        <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">
          Ready to start?
        </h3>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Create your free account in 2 minutes.
        </p>
        <button
          onClick={() => navigate('/register')}
          className="rounded-xl bg-blue-600 px-8 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          Start free
        </button>
      </div>
    </div>
  );
};

export default PricingPage;
