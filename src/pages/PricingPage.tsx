// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * PricingPage (/pricing) — the actual PropXchain model.
 *
 *  - Starter is FREE. Self-serve, pay-as-you-go: you pick your own
 *    providers and pay at the prices shown up front. Searches are bought
 *    through PropXchain. No platform fee.
 *  - Premium is £75 per transaction. Everything in Starter, plus an
 *    AI co-pilot: it reads your HM Land Registry title and your search
 *    results in plain English, turns the actual complexity of your
 *    transaction into a tailored conveyancer quote request, and guides
 *    you through every step.
 *
 * PropXchain never marks up conveyancer fees — the conveyancer quotes
 * you directly.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { IS_REGISTRATION_OPEN, PRELAUNCH_CAPTURE_PATH } from '../config/registration';

interface Tier {
  name: string;
  blurb: string;
  price: string;
  priceNote: string;
  features: string[];
  cta: string;
  ctaPath: string;
  featured?: boolean;
}

const TIERS: Tier[] = [
  {
    name: 'Starter',
    blurb: 'Self-serve, pay-as-you-go. Pick your own providers and see every price up front.',
    price: 'Free',
    priceNote: 'no platform fee',
    features: [
      'On-chain transaction record and audit trail',
      'HM Land Registry title pull — £7, names the registered owner',
      'TA6 + TA10 digital forms',
      'Document vault and verification',
      'Buyer invite and progress tracker',
      'Conveyancer panel access',
    ],
    cta: 'Start free',
    ctaPath: '/register',
  },
  {
    name: 'Premium',
    blurb: 'Everything in Starter, plus an AI co-pilot for the whole transaction.',
    price: '£75',
    priceNote: 'per transaction',
    features: [
      'Everything in Starter',
      'AI reads your HMLR title — issues flagged, summarised in plain English',
      'AI reads your search results — the material issues pulled out for you',
      'A complexity-aware conveyancer quote request — often a tighter price',
      'AI next-step cards guide you through every stage',
      'Priority support',
    ],
    cta: 'Add the AI co-pilot',
    ctaPath: '/register',
    featured: true,
  },
];

const OTHER_COSTS = [
  {
    label: 'Property searches',
    cost: '£50–450',
    note: 'You pick the provider and pay the rate shown',
  },
  {
    label: 'Conveyancer (reserved acts)',
    cost: 'Quote',
    note: 'Quoted directly per transaction — PropXchain never marks it up',
  },
  {
    label: 'Stamp duty',
    cost: 'Calculated by HMRC',
    note: 'Varies by property price',
  },
];

const FAQS = [
  {
    q: 'Is it really free to start?',
    a: 'Yes. Starter has no platform fee. You run your own transaction, pick your own providers, and see every price before you commit.',
  },
  {
    q: 'What does the £75 Premium tier add?',
    a: 'An AI co-pilot for the whole transaction. It reads your HM Land Registry title and your search results in plain English and flags the issues that actually matter, turns the real complexity of your transaction into a tailored conveyancer quote request, and gives you next-step cards that guide you through every stage. Same pricing underneath — you still see every provider\'s price before you commit.',
  },
  {
    q: 'How does the AI get me a better conveyancer quote?',
    a: 'Conveyancers normally price for the average transaction because they cannot see yours yet. Premium feeds the conveyancer a quote request built from your actual title, your actual searches, and the material issues the AI surfaced — so they can quote on the real work instead of pricing in unknown risk. You often get a tighter quote; they get a more predictable job.',
  },
  {
    q: 'What about solicitor/conveyancer fees?',
    a: 'The conveyancer quotes you directly per transaction. PropXchain never marks up their fee. You compare and choose from the panel, or invite your own.',
  },
  {
    q: 'Are there any hidden fees?',
    a: 'No. Starter is free. Premium is £75 per transaction for the AI co-pilot. Your conveyancer quotes you direct and PropXchain never marks that up. Searches are paid at the rate shown before you commit.',
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
          Start free. Add AI when you want it.
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          Pick your own providers and see every price up front. Upgrade to the £75 AI
          co-pilot to have your title and searches read in plain English.
        </p>
      </div>

      {/* Tiers */}
      <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={
              tier.featured
                ? 'relative rounded-2xl border border-blue-600/40 bg-white dark:bg-slate-800/70 p-8 shadow-lg shadow-blue-600/10'
                : 'rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-8'
            }
          >
            {tier.featured && (
              <span className="absolute -top-3 right-6 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                Popular
              </span>
            )}
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">{tier.name}</h2>
            <p className="mt-2 min-h-[3rem] text-sm text-slate-600 dark:text-slate-400">{tier.blurb}</p>
            <div className="mt-4 mb-6">
              <span className="text-5xl font-bold text-slate-900 dark:text-slate-50">{tier.price}</span>
              <span className="ml-2 text-sm text-slate-600 dark:text-slate-400">{tier.priceNote}</span>
            </div>
            <ul className="space-y-3 mb-8">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-400 text-xs">
                    &#10003;
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            {/* Both tier CTAs pointed at /register unconditionally, so while
                sign-ups are closed the two biggest buttons on the pricing page
                led straight to "Sign-ups open at launch". Route to the capture
                path — the one consumer journey that IS open — and say so. */}
            <button
              onClick={() =>
                navigate(IS_REGISTRATION_OPEN ? tier.ctaPath : PRELAUNCH_CAPTURE_PATH)
              }
              className={
                tier.featured
                  ? 'w-full rounded-xl bg-blue-600 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-700'
                  : 'w-full rounded-xl border border-slate-300 dark:border-slate-600 py-3 text-base font-semibold text-slate-900 dark:text-slate-100 transition-colors hover:border-blue-500 hover:text-slate-900 dark:hover:text-white'
              }
            >
              {IS_REGISTRATION_OPEN ? tier.cta : 'Get the free Home Mover Report'}
            </button>
          </div>
        ))}
      </div>

      {/* Other Costs */}
      <div className="mx-auto mt-16 max-w-3xl">
        <h2 className="mb-6 text-center text-2xl font-bold text-slate-900 dark:text-slate-50">
          What else you pay (and who you pay it to)
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {OTHER_COSTS.map((item) => (
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
          You pick your providers. Every cost is shown before you commit, and conveyancer fees are never marked up.
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
          Create your free account in 2 minutes — add the AI co-pilot whenever you like.
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
