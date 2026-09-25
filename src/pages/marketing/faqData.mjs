// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * FAQ content — single source of truth for /faq.
 *
 * Plain ESM (.mjs) on purpose: imported by BOTH the React page
 * (src/pages/marketing/FaqPage.tsx, via Vite) and the Node prerender
 * script (scripts/prerender-marketing.mjs). The visible Q&As and the
 * FAQPage JSON-LD are derived from this one array so they can never
 * drift apart — Google requires exact parity between the two.
 *
 * Types live in the sibling faqData.d.ts.
 *
 * Copy rules (do not contradict):
 *  - Starter is FREE, no platform fee. Premium is an optional £75 per
 *    transaction, paid by the SELLER. Buyers use PropXchain free.
 *  - Searches £50–£450, bought through PropXchain.
 *  - Conveyancers quote directly per transaction — never a fixed £ fee.
 *  - PropXchain is a coordination platform, NOT a conveyancer/ABS.
 *    Reserved legal acts are performed by CLC-verified conveyancers.
 *
 * The five Pricing answers marked "canonical" are reused verbatim from
 * src/pages/PricingPage.tsx — keep them in sync if either changes.
 */

export const FAQ_GROUPS = [
  {
    id: 'getting-started',
    title: 'Getting started',
    items: [
      {
        q: 'What is PropXchain?',
        a: 'PropXchain is an online platform for property transactions in England and Wales. Sellers, buyers and conveyancers work from the same live transaction — HM Land Registry title, digital forms, searches, documents and messages in one place — with every milestone recorded on the Internet Computer blockchain as a tamper-proof audit trail.',
      },
      {
        q: 'Who is PropXchain for?',
        a: 'Anyone selling or buying residential property in England and Wales, plus the conveyancers and small housebuilders who work with them. Sellers run the transaction, buyers follow along free, and CLC-verified conveyancers handle the legal work. Properties in Scotland and Northern Ireland are not supported yet, as they use different land registration systems.',
      },
      {
        q: 'How do I sign in? Do I need a password?',
        a: 'Two options: a standard email account, or Internet Identity — passwordless sign-in built into the Internet Computer. Internet Identity uses your device biometrics or a security key, so there is no password to remember and no password database to breach. Either way you get the same dashboard.',
      },
      {
        q: 'How long does a transaction take?',
        a: 'UK conveyancing averages 20+ weeks. PropXchain transactions routinely complete in 4–8 weeks when both sides are on the platform, because everyone sees the same live transaction — no chasing by phone, no waiting for the post.',
      },
    ],
  },
  {
    id: 'pricing',
    title: 'Pricing',
    items: [
      {
        // Canonical — verbatim from PricingPage.tsx
        q: 'Is it really free to start?',
        a: 'Yes. Starter has no platform fee. You run your own transaction, pick your own providers, and see every price before you commit.',
      },
      {
        // Canonical — verbatim from PricingPage.tsx
        q: 'What does the £75 Premium tier add?',
        a: 'An AI co-pilot for the whole transaction. It reads your HM Land Registry title and your search results in plain English and flags the issues that actually matter, turns the real complexity of your transaction into a tailored conveyancer quote request, and gives you next-step cards that guide you through every stage. Same pricing underneath — you still see every provider\'s price before you commit.',
      },
      {
        // Canonical — verbatim from PricingPage.tsx
        q: 'How does the AI get me a better conveyancer quote?',
        a: 'Conveyancers normally price for the average transaction because they cannot see yours yet. Premium feeds the conveyancer a quote request built from your actual title, your actual searches, and the material issues the AI surfaced — so they can quote on the real work instead of pricing in unknown risk. You often get a tighter quote; they get a more predictable job.',
      },
      {
        q: 'How do property searches work, and what do they cost?',
        a: 'You order searches from inside your transaction — pick a provider and see the rate up front. A typical residential pack (local authority, drainage and water, environmental) costs £50–£450. Results land back in the transaction where you, your buyer and your conveyancer can all see them.',
      },
      {
        // Canonical — verbatim from PricingPage.tsx
        q: 'Are there any hidden fees?',
        a: 'No. Starter is free. Premium is £75 per transaction for the AI co-pilot. Your conveyancer quotes you direct and PropXchain never marks that up. Searches are paid at the rate shown before you commit.',
      },
    ],
  },
  {
    id: 'conveyancers',
    title: 'Conveyancers & legal',
    items: [
      {
        q: 'Is PropXchain a conveyancer or a law firm?',
        a: 'No. PropXchain is a coordination platform — it organises the transaction, the documents and the people. The reserved legal activities (exchange of contracts, transfer of title, completion) are always performed by a CLC-verified conveyancer, either chosen from the panel or invited by you.',
      },
      {
        // Canonical — verbatim from PricingPage.tsx
        q: 'What about solicitor/conveyancer fees?',
        a: 'The conveyancer quotes you directly per transaction. PropXchain never marks up their fee. You compare and choose from the panel, or invite your own.',
      },
      {
        q: 'Can I use my own solicitor or conveyancer?',
        a: 'Yes. Invite them to the transaction and they get the same shared live view as a panel firm — documents, searches and progress in one place. The panel is there if you would rather compare quotes, never a requirement.',
      },
      {
        q: 'How does signing work? Is an electronic signature legally valid?',
        a: 'Exchange and completion documents are signed with qualified electronic signatures — the highest standard of e-signature under UK law, applied through a regulated signing provider. Each signature is identity-verified, and the signed contract is recorded on the blockchain audit trail.',
      },
    ],
  },
  {
    id: 'security',
    title: 'Security & blockchain',
    items: [
      {
        q: 'Is my data safe? What actually goes on the blockchain?',
        a: 'Milestones and document hashes — not your documents or personal details. When something important happens (a form is completed, a search lands, contracts are exchanged), PropXchain writes a timestamped event and a cryptographic fingerprint of the document to the Internet Computer. Anyone you authorise can verify the history; nobody can rewrite it. The documents themselves stay in your encrypted vault and are never published on-chain.',
      },
      {
        q: 'How does identity and AML verification work?',
        a: 'Through regulated identity providers, not in-house checks. You complete the ID and anti-money-laundering verification once, the provider issues a certificate, and the result is recorded on your transaction audit trail so every party — including lenders — can rely on it without repeating the process.',
      },
    ],
  },
  {
    id: 'buyers',
    title: 'Buyers',
    items: [
      {
        q: 'Do buyers pay anything to use PropXchain?',
        a: 'No. Buyers use PropXchain completely free. The optional £75 Premium AI co-pilot is paid by the seller — buyers are never charged a platform fee. A buyer’s usual costs (their own conveyancer if they appoint one, survey, lender fees) are paid direct to those providers, exactly as in any transaction.',
      },
      {
        q: 'What happens if the sale falls through?',
        a: 'The transaction is closed and the audit trail keeps a permanent record of what happened — useful if anything is disputed later. There is no platform fee to lose on the Starter tier. Searches you have already paid for are usually valid for around six months, so they can often be reused with a new buyer.',
      },
    ],
  },
];

/**
 * Build the schema.org FAQPage JSON-LD from the same data the page
 * renders. Question/Answer text mirrors the visible Q&As exactly.
 */
export function buildFaqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_GROUPS.flatMap((group) => group.items).map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };
}
