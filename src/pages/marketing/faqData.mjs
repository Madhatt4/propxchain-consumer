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
 *  - PropXchain is FREE to use for every party (Marc, 2026-10-15). No plans,
 *    no tiers, no platform fee.
 *  - Third-party items are paid per item, priced when ordered: searches
 *    (bought through PropXchain, sold with a margin — never say "at cost" or
 *    "no mark-up"), ID & AML checks, the £7 title pull, the £25 chain check.
 *  - Conveyancers quote directly per transaction — never a fixed £ fee.
 *  - PropXchain is a coordination platform, NOT a conveyancer/ABS.
 *    Reserved legal acts are performed by CLC-verified conveyancers.
 *
 * The Pricing answers marked "canonical" are reused verbatim from
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
        q: 'Is PropXchain the same as Propchain?',
        a: 'No. Propchain (PROPC) is an unrelated crypto token and real-estate tokenisation project. PropXchain is a UK property transaction platform run by PropXchain Ltd (Companies House 17018978). It has no token or coin; it uses the Internet Computer blockchain only to record a tamper-proof audit trail of your transaction.',
      },
      {
        q: 'Can I use PropXchain from Claude, ChatGPT or another AI assistant?',
        a: 'Yes. PropXchain has a hosted MCP (Model Context Protocol) server at https://mcp.propxchain.com/mcp. Add it as a custom connector in Claude, ChatGPT, Cursor or any MCP client, approve with your PropXchain email and a one-time code, then give your assistant a transaction invite code. It can read the transaction, check what is outstanding and explain each step, while money and legal actions still wait for you. Setup guide: propxchain.com/agent.',
      },
      {
        q: 'How do I sign in? Do I need a password?',
        a: 'Two options: a standard email account, or Internet Identity — passwordless sign-in built into the Internet Computer. Internet Identity uses your device biometrics or a security key, so there is no password to remember and no password database to breach. Either way you get the same dashboard.',
      },
      {
        q: 'How long does a transaction take?',
        a: 'UK conveyancing averages 20+ weeks. PropXchain is built to shorten that: the title, searches and property information are gathered up front, and everyone sees the same live transaction — no chasing by phone, no waiting for the post. How long your own move takes still depends on your buyer, any chain and the conveyancers.',
      },
    ],
  },
  {
    id: 'pricing',
    title: 'Pricing',
    items: [
      {
        // Canonical — verbatim from PricingPage.tsx
        q: 'Is PropXchain really free?',
        a: 'Yes. Using PropXchain is free for buyers and sellers. There are no plans, no tiers and no platform fee.',
      },
      {
        // Canonical — verbatim from PricingPage.tsx
        q: 'So what do I pay for?',
        a: 'Only the third-party items you choose to order: property searches, ID and AML checks, the £7 HM Land Registry title pull and the £25 property chain check. Each one is priced when you order, before you pay.',
      },
      {
        q: 'How do property searches work, and what do they cost?',
        a: 'You order searches from inside your transaction — pick a provider and see the price before you pay. Searches are bought through PropXchain and paid per item. Results land back in the transaction where you, your buyer and your conveyancer can all see them.',
      },
      {
        // Canonical — verbatim from PricingPage.tsx
        q: 'Will it always be free?',
        a: 'Everything on PropXchain is free today. We may add paid extras later. If we do, you will see the price before you pay.',
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
        a: 'The conveyancer quotes you directly for your transaction. You compare and choose from the panel, or invite your own.',
      },
      {
        q: 'Can I use my own solicitor or conveyancer?',
        a: 'Yes. Invite them to the transaction and they get the same shared live view as a panel firm — documents, searches and progress in one place. The panel is there if you would rather compare quotes, never a requirement.',
      },
      {
        q: 'How does signing work? Is an electronic signature legally valid?',
        a: 'Electronic signatures are legally valid in the UK. Today, contracts are signed and exchanged by your conveyancers in the usual way, and PropXchain records that the exchange has happened on its audit trail. Signing inside PropXchain with a qualified electronic signature — the highest standard under UK law — is planned and not yet available.',
      },
    ],
  },
  {
    id: 'security',
    title: 'Security & blockchain',
    items: [
      {
        q: 'Is my data safe? What actually goes on the blockchain?',
        a: 'Milestones and document hashes. When something important happens (a form is completed, a search lands, contracts are exchanged), PropXchain writes a timestamped event and a cryptographic fingerprint of the document to the Internet Computer. The documents themselves stay in your encrypted vault and are never published on-chain.',
      },
      {
        q: 'How does identity and AML verification work?',
        a: 'Through regulated identity providers, not in-house checks. You complete the ID and anti-money-laundering verification with the provider.',
      },
    ],
  },
  {
    id: 'buyers',
    title: 'Buyers',
    items: [
      {
        q: 'Do buyers pay anything to use PropXchain?',
        a: 'No. PropXchain is free to use for buyers and sellers — there is no platform fee. A buyer’s usual costs (their own conveyancer if they appoint one, survey, lender fees) are paid direct to those providers, exactly as in any transaction.',
      },
      {
        q: 'What happens if the sale falls through?',
        a: 'The transaction is closed and the audit trail keeps a permanent record of what happened — useful if anything is disputed later. There is no platform fee to lose. Searches you have already paid for are usually valid for around six months, so they can often be reused with a new buyer.',
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
