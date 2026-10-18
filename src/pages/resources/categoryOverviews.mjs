// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Per-section copy for the /resources/<category> pillar pages that appears in
 * both the React page and its static prerender, so the two cannot drift apart.
 *
 * Plain ESM (.mjs) on purpose: imported by ResourceCategoryPage via Vite and by
 * scripts/prerender-resources.mjs under Node. Types live in
 * categoryOverviews.d.ts.
 *
 * `metaDescription` is the search-result snippet (70–160 characters; a test
 * enforces it). `overview` is plain text, one string per paragraph — every fact
 * in it must already be stated, with its source, in one of the section's guides.
 * Only categories with a published guide need an entry.
 */

export const CATEGORY_OVERVIEWS = Object.freeze({
  'getting-started': Object.freeze({
    metaDescription:
      'How to register and sign in to PropXchain as a seller, buyer, conveyancer, developer or estate agent, and the three ways to sign back in.',
    overview: Object.freeze([
      'PropXchain has five kinds of account, and each one starts from its own registration page. Sellers and buyers share the main page at propxchain.com/register and can join with Google, Microsoft, or an email address and password. Conveyancers and solicitors apply to the panel with their firm\'s CLC practice ID, developers register with a Companies House number, and estate agents give their agency, branch and redress scheme details.',
      'Once you have an account, signing in works the same way for everyone: Google, Microsoft, email and password, or Internet Identity, the passkey-based sign-in. Internet Identity is a separate identity from an email or Google account, so sign back in the way you registered. If you are not sure which way that was, try email first: PropXchain tells you when an address already has an account rather than creating a second one.',
      'Using PropXchain is free for buyers and sellers. You only pay for the third-party items you choose to order, such as searches and ID checks, and each one is priced before you pay.',
    ]),
  }),
  selling: Object.freeze({
    metaDescription:
      'Plain-English guides to selling a home in England and Wales: sales packs, the TA6, TA10 and TA7 forms, and what to prepare before you list.',
    overview: Object.freeze([
      'Much of the delay in a house sale comes from information that is collected late. The buyer\'s conveyancer and lender will ask for the title register, the searches, the seller\'s property information forms and a set of certificates and guarantees. In a traditional sale these are gathered one request at a time after an offer is accepted, while everyone waits.',
      'The guides in this section cover the seller\'s side of that work: what a sales pack is and why gathering it before you list makes a sale less likely to fall through, how the TA6, TA10 and TA7 forms fit together, and what each section of the TA6 (6th edition) asks. Your answers on these forms are statements a buyer is entitled to rely on, so the guides also explain when "not known" is the honest answer.',
      'Nothing here replaces your conveyancer, who remains responsible for the legal work. The aim is to help you arrive with the paperwork ready, so the legal work starts from a complete file rather than a list of requests.',
    ]),
  }),
  buying: Object.freeze({
    metaDescription:
      'Plain-English guides to buying a home in England and Wales: how long conveyancing takes, each stage from offer to keys, and what causes delays.',
    overview: Object.freeze([
      'Buying a home in England and Wales usually takes months, not weeks. Rightmove put the average at 167 days from sale agreed to completion as of March 2026, and most of that time is spent waiting: for searches, for the mortgage offer, for answers to enquiries, and for the slowest link in the chain.',
      'The guides in this section follow the buyer\'s side of the transaction in order: identity checks and instructing a conveyancer, searches and the survey, enquiries, exchange of contracts, and completion. They explain what each stage involves, how long it tends to take, and which delays you can do something about.',
      'Buyers use PropXchain free. When the sale runs on PropXchain, you see the same live view of the transaction as the seller and the conveyancers, so you know where things stand without chasing.',
    ]),
  }),
  'searches-and-legal': Object.freeze({
    metaDescription:
      'Property searches in plain English: local authority, drainage, environmental and coal searches, what each tells you, what they cost and how long they take.',
    overview: Object.freeze([
      'Between an accepted offer and exchange of contracts sits the technical middle of a transaction: property searches, the title, and the enquiries a buyer\'s conveyancer raises. It is where most of the waiting happens, and the part buyers and sellers are least often told about.',
      'A property search is a records check, not an inspection. The local authority search, the drainage and water search and an environmental report apply to almost every purchase; others, such as a coal mining search, depend on where the house is. The local authority search usually sets the pace, and how quickly it comes back depends on the council.',
      'The guides here explain which searches are done, what each one tells you, how long they take, what they cost and how long they stay valid, so you can read the results with your conveyancer rather than just paying for them.',
    ]),
  }),
  'industry-and-reform': Object.freeze({
    metaDescription:
      'Where home moving in England and Wales is heading: BASPI, material information rules, upfront property data and the reform agenda, in plain English.',
    overview: Object.freeze([
      'Home moving in England and Wales is changing. The government\'s June 2026 Home Buying and Selling Reform Roadmap uses the term sales pack for property information gathered before a home is marketed, and estate agents are expected to disclose material information about a property in its listing.',
      'Industry groups are working on the same problem. The Home Buying and Selling Group developed BASPI, the Buyer\'s and Seller\'s Property Information form, as a single dataset covering a property, and backs the Property Data Trust Framework so verified information can move digitally between agents, conveyancers and lenders instead of being retyped at every step.',
      'The guides in this section explain what these changes mean if you are buying or selling now, and which parts are already in force rather than still on the way.',
    ]),
  }),
});
