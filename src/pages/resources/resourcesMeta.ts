// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Resources hub — shared metadata. One entry per article across the
 * category taxonomy (docs/press/content-plan). Consumed by the hub, the
 * pillar pages, ResourceLayout, and per-route document titles. Prerender
 * copy lives separately in scripts/prerender-resources.mjs.
 */

export type CategorySlug =
  | 'getting-started'
  | 'selling'
  | 'buying'
  | 'searches-and-legal'
  | 'probate'
  | 'auction'
  | 'industry-and-reform'
  | 'product-updates';

export interface ResourceCategory {
  slug: CategorySlug;
  name: string;
  /** One-line purpose shown on the hub card and pillar header. */
  description: string;
  priority: 'P1' | 'P2' | 'P3';
}

export type ArticleStatus = 'published' | 'planned';

export type SearchIntent = 'Informational' | 'Commercial' | 'Transactional';

interface PlannedArticle {
  status: 'planned';
  slug: string;
  category: CategorySlug;
  /** Position in the content plan's article map, where one exists. */
  planNumber: number | null;
  title: string;
  keyword: string;
  intent: SearchIntent;
  /** Publishing sequence phase from the plan (1 = money pages). */
  phase: 1 | 2 | 3 | 4;
}

export interface PublishedArticle {
  status: 'published';
  slug: string;
  category: CategorySlug;
  planNumber: number | null;
  title: string;
  documentTitle: string;
  teaser: string;
  readingTime: string;
  /** ISO date the content was last reviewed. */
  updated: string;
}

export type ResourceArticle = PlannedArticle | PublishedArticle;

export const CATEGORIES: ResourceCategory[] = [
  {
    slug: 'getting-started',
    name: 'Getting Started',
    description: 'Registering and signing in, whichever kind of account you need.',
    priority: 'P1',
  },
  {
    slug: 'selling',
    name: 'Selling',
    description: 'The seller-side journey, from listing to completion.',
    priority: 'P1',
  },
  {
    slug: 'buying',
    name: 'Buying',
    description: 'The buyer-side journey, from agreement in principle to keys.',
    priority: 'P1',
  },
  {
    slug: 'searches-and-legal',
    name: 'Searches & Legal',
    description: 'The technical middle of the transaction, where most delay happens.',
    priority: 'P1',
  },
  {
    slug: 'probate',
    name: 'Probate & Inherited Property',
    description: 'Selling when the owner has died: grants, valuations, executor duties.',
    priority: 'P2',
  },
  {
    slug: 'auction',
    name: 'Auction',
    description: 'Traditional and Modern Method, legal packs, and the exchange clock.',
    priority: 'P2',
  },
  {
    slug: 'industry-and-reform',
    name: 'Industry & Reform',
    description: 'Where home moving is heading: data, reform, and upfront information.',
    priority: 'P3',
  },
  {
    slug: 'product-updates',
    name: 'Product Updates',
    description: 'Release notes and feature launches.',
    priority: 'P3',
  },
];

export const RESOURCES: ResourceArticle[] = [
  // --- Getting Started (published) ---
  {
    status: 'published',
    slug: 'how-to-sign-in',
    category: 'getting-started',
    planNumber: null,
    title: 'How to sign in, by account type',
    documentTitle: 'How to Sign In to PropXchain — Sellers, Buyers, Conveyancers, Developers, Agents · PropXchain',
    teaser:
      'Sellers, buyers, conveyancers, developers and estate agents each register through a different door. What each one asks for, and the three ways to sign back in once you have an account.',
    readingTime: '4 min read',
    updated: '2026-09-04',
  },
  // --- Selling (published) ---
  {
    status: 'published',
    slug: 'what-is-a-property-pack',
    category: 'selling',
    planNumber: null,
    title: 'What is a sales pack?',
    documentTitle:
      'What Is a Sales Pack? Upfront Property Information Explained · PropXchain',
    teaser:
      'Title register, searches, TA6, EPC: the documents every buyer eventually needs, gathered before you list rather than after you accept an offer. The government calls it a sales pack — you may know it as a property pack. Why upfront information sells houses faster, and what actually goes in one.',
    readingTime: '6 min read',
    updated: '2026-08-14',
  },
  {
    status: 'published',
    slug: 'property-information-forms-explained',
    category: 'selling',
    planNumber: 10,
    title: 'TA6, TA10 and TA7 explained',
    documentTitle:
      'TA6, TA10 and TA7 Explained: the Seller’s Property Information Forms · PropXchain',
    teaser:
      'The three forms every seller fills in, what each one asks, why your answers are legally binding representations rather than opinions, and the questions people most often get wrong.',
    readingTime: '7 min read',
    updated: '2026-08-21',
  },
  // --- Selling (planned, plan numbers 1–16) ---
  { status: 'planned', slug: 'getting-sale-ready', category: 'selling', planNumber: 1, title: 'Getting Sale-Ready: The Paperwork That Decides Whether You Exchange in Weeks or Months', keyword: 'sale ready property', intent: 'Informational', phase: 3 },
  { status: 'planned', slug: 'choosing-an-estate-agent', category: 'selling', planNumber: 2, title: 'Choosing an Estate Agent: Tie-In Periods, Fee Structures and What to Negotiate', keyword: 'instructing an estate agent', intent: 'Commercial', phase: 3 },
  { status: 'planned', slug: 'material-information-rules', category: 'selling', planNumber: 3, title: 'Material Information Rules: What You Must Disclose Before Your Listing Goes Live', keyword: 'material information property listing', intent: 'Informational', phase: 3 },
  { status: 'planned', slug: 'epc-and-compliance-documents', category: 'selling', planNumber: 4, title: 'EPC, Compliance and the Documents You Legally Need Before Marketing', keyword: 'documents needed to sell a house uk', intent: 'Informational', phase: 3 },
  { status: 'planned', slug: 'pricing-your-property', category: 'selling', planNumber: 5, title: 'Pricing Your Property: How to Read Comparables and Portal Data Properly', keyword: 'how to price my house to sell', intent: 'Informational', phase: 3 },
  { status: 'planned', slug: 'preparing-for-viewings', category: 'selling', planNumber: 6, title: 'Preparing for Viewings: What Buyers Actually Notice', keyword: 'preparing house for viewings', intent: 'Informational', phase: 3 },
  { status: 'planned', slug: 'reading-your-marketing-report', category: 'selling', planNumber: 7, title: 'Reading Your Marketing Report: When the Numbers Mean Reprice', keyword: 'house not selling what to do', intent: 'Informational', phase: 3 },
  { status: 'planned', slug: 'offer-accepted-what-happens-next', category: 'selling', planNumber: 8, title: 'Offer Accepted: What Happens in the Next Seven Days', keyword: 'offer accepted on house what next', intent: 'Informational', phase: 1 },
  { status: 'planned', slug: 'memorandum-of-sale', category: 'selling', planNumber: 9, title: 'Memorandum of Sale: What It Records and Why It Isn’t Binding', keyword: 'memorandum of sale', intent: 'Informational', phase: 1 },
  { status: 'planned', slug: 'draft-contract-pack', category: 'selling', planNumber: 11, title: 'The Draft Contract Pack: What Your Conveyancer Sends and Why', keyword: 'draft contract house sale', intent: 'Informational', phase: 3 },
  { status: 'planned', slug: 'answering-legal-enquiries', category: 'selling', planNumber: 12, title: 'Answering Legal Enquiries Fast: The Single Biggest Cause of Delay', keyword: 'legal enquiries conveyancing', intent: 'Informational', phase: 1 },
  { status: 'planned', slug: 'buyers-survey-renegotiation', category: 'selling', planNumber: 13, title: 'The Buyer’s Survey: What Sellers See and How to Handle Renegotiation', keyword: 'buyer survey renegotiation', intent: 'Informational', phase: 3 },
  { status: 'planned', slug: 'agreeing-a-completion-date', category: 'selling', planNumber: 14, title: 'Agreeing a Completion Date Across a Chain', keyword: 'how is completion date agreed', intent: 'Informational', phase: 3 },
  { status: 'planned', slug: 'exchange-of-contracts', category: 'selling', planNumber: 15, title: 'Exchange of Contracts: What It Commits You To', keyword: 'exchange of contracts', intent: 'Informational', phase: 1 },
  { status: 'planned', slug: 'completion-day-hour-by-hour', category: 'selling', planNumber: 16, title: 'Completion Day, Hour by Hour', keyword: 'completion day what happens', intent: 'Informational', phase: 1 },
  // --- Buying (published) ---
  {
    status: 'published',
    slug: 'how-long-does-conveyancing-take',
    category: 'buying',
    planNumber: null,
    title: 'How long does conveyancing take?',
    documentTitle:
      'How Long Does Conveyancing Take in the UK? A Realistic Timeline · PropXchain',
    teaser:
      'A realistic stage-by-stage timeline for England and Wales, the delays that genuinely cost weeks (searches, chains, enquiry ping-pong), and what sellers and buyers can do to shorten the wait.',
    readingTime: '7 min read',
    updated: '2026-06-12',
  },
  // --- Buying (planned, plan numbers 17–30) ---
  { status: 'planned', slug: 'agreement-in-principle-vs-mortgage-offer', category: 'buying', planNumber: 17, title: 'Agreement in Principle vs Full Mortgage Application', keyword: 'agreement in principle vs mortgage offer', intent: 'Informational', phase: 3 },
  { status: 'planned', slug: 'first-broker-appointment', category: 'buying', planNumber: 18, title: 'Your First Broker Appointment: What to Bring', keyword: 'first mortgage appointment', intent: 'Informational', phase: 3 },
  { status: 'planned', slug: 'proof-of-funds', category: 'buying', planNumber: 19, title: 'Proof of Funds: What You Must Evidence, Including Gifted Deposits', keyword: 'proof of funds buying a house', intent: 'Informational', phase: 3 },
  { status: 'planned', slug: 'aml-and-id-checks', category: 'buying', planNumber: 20, title: 'AML and ID Checks: Why Every Party Runs Their Own', keyword: 'aml checks buying a house', intent: 'Informational', phase: 3 },
  { status: 'planned', slug: 'choosing-a-conveyancer', category: 'buying', planNumber: 21, title: 'Choosing a Conveyancer: What to Ask Before You Instruct', keyword: 'how to choose a conveyancer', intent: 'Commercial', phase: 3 },
  { status: 'planned', slug: 'survey-levels-explained', category: 'buying', planNumber: 22, title: 'Survey Levels 1, 2 and 3: What Each Covers and How Long It Takes', keyword: 'house survey types', intent: 'Commercial', phase: 3 },
  { status: 'planned', slug: 'understanding-your-chain', category: 'buying', planNumber: 26, title: 'Understanding Your Chain: How It Forms and Why It Collapses', keyword: 'property chain explained', intent: 'Informational', phase: 1 },
  { status: 'planned', slug: 'stamp-duty-rates', category: 'buying', planNumber: 27, title: 'Stamp Duty: Rates, Surcharges and First-Time Buyer Relief', keyword: 'stamp duty calculator uk', intent: 'Transactional', phase: 3 },
  { status: 'planned', slug: 'buying-leasehold', category: 'buying', planNumber: 28, title: 'Buying Leasehold: Management Packs, Ground Rent, Service Charges', keyword: 'buying a leasehold flat', intent: 'Informational', phase: 3 },
  { status: 'planned', slug: 'new-build-legal-packs', category: 'buying', planNumber: 29, title: 'New Build Legal Packs, NHBC Buildmark and Longstop Dates', keyword: 'new build legal pack', intent: 'Informational', phase: 3 },
  { status: 'planned', slug: 'mortgage-offer-expiry', category: 'buying', planNumber: 30, title: 'When Your Mortgage Offer Is About to Expire', keyword: 'mortgage offer expired before completion', intent: 'Informational', phase: 3 },
  // --- Searches & Legal (published) ---
  {
    status: 'published',
    slug: 'property-searches-explained',
    category: 'searches-and-legal',
    planNumber: 23,
    title: 'Property searches explained',
    documentTitle:
      'Property Searches Explained: What They Are and Which You Need · PropXchain',
    teaser:
      'Local authority, drainage, environmental, coal: the searches a conveyancer orders before you can exchange, what each one actually tells you, why the list changes depending on where the house is, and how long they stay valid.',
    readingTime: '8 min read',
    updated: '2026-08-21',
  },
  // --- Searches & Legal (planned — plan numbers 24–25, reassigned from the
  // Buying table: these are the searches/legal middle the taxonomy describes) ---
  { status: 'planned', slug: 'reading-your-search-results', category: 'searches-and-legal', planNumber: 24, title: 'Reading Your Search Results: What Actually Kills a Purchase', keyword: 'search results problems house purchase', intent: 'Informational', phase: 1 },
  { status: 'planned', slug: 'report-on-title', category: 'searches-and-legal', planNumber: 25, title: 'Report on Title: What Your Conveyancer Is Actually Telling You', keyword: 'report on title', intent: 'Informational', phase: 3 },
  // --- Probate (planned, plan numbers 31–35) ---
  { status: 'planned', slug: 'probate-solicitor-to-sell', category: 'probate', planNumber: 31, title: 'Do You Need a Probate Solicitor to Sell an Inherited Property?', keyword: 'probate solicitor to sell house', intent: 'Commercial', phase: 2 },
  { status: 'planned', slug: 'probate-property-valuation', category: 'probate', planNumber: 32, title: 'Valuing an Estate for Probate: Date-of-Death and RICS Red Book', keyword: 'probate property valuation', intent: 'Informational', phase: 2 },
  { status: 'planned', slug: 'grant-of-probate-timelines', category: 'probate', planNumber: 33, title: 'Applying for Grant of Probate: Documents and Current Timelines', keyword: 'how long does probate take uk', intent: 'Informational', phase: 2 },
  { status: 'planned', slug: 'selling-a-probate-property', category: 'probate', planNumber: 34, title: 'Selling a Probate Property: Executor Duties to Beneficiaries', keyword: 'selling a probate property', intent: 'Informational', phase: 2 },
  { status: 'planned', slug: 'inheritance-tax-and-property', category: 'probate', planNumber: 35, title: 'Inheritance Tax and Property: What Executors Need Before Selling', keyword: 'inheritance tax on property', intent: 'Informational', phase: 2 },
  // --- Auction (planned, plan numbers 36–41) ---
  { status: 'planned', slug: 'traditional-vs-modern-method', category: 'auction', planNumber: 36, title: 'Traditional vs Modern Method of Auction', keyword: 'modern method of auction', intent: 'Informational', phase: 3 },
  { status: 'planned', slug: 'auction-legal-pack', category: 'auction', planNumber: 37, title: 'The Auction Legal Pack: What Goes In and Why Early Matters', keyword: 'auction legal pack', intent: 'Informational', phase: 3 },
  { status: 'planned', slug: 'guide-price-vs-reserve-price', category: 'auction', planNumber: 38, title: 'Guide Price vs Reserve Price: How They Differ', keyword: 'guide price vs reserve price', intent: 'Informational', phase: 3 },
  { status: 'planned', slug: 'reading-bidder-interest', category: 'auction', planNumber: 39, title: 'Reading Bidder Interest: Pack Downloads vs Registered Bidders', keyword: 'auction bidder interest', intent: 'Informational', phase: 3 },
  { status: 'planned', slug: 'reservation-fees-and-stamp-duty', category: 'auction', planNumber: 40, title: 'Reservation Fees, the Exchange Clock and the Stamp Duty Trap', keyword: 'auction reservation fee stamp duty', intent: 'Informational', phase: 3 },
  { status: 'planned', slug: 'auction-completion-deadlines', category: 'auction', planNumber: 41, title: 'Auction Completion: Timelines and What Happens If You Miss', keyword: 'auction completion deadline', intent: 'Informational', phase: 3 },
  // --- Industry & Reform (published) ---
  {
    status: 'published',
    slug: 'baspi-explained',
    category: 'industry-and-reform',
    planNumber: null,
    title: 'BASPI explained',
    documentTitle:
      'BASPI Explained: the Buyer’s and Seller’s Property Information Form · PropXchain',
    teaser:
      'The Buyer’s and Seller’s Property Information form is the industry’s blueprint for upfront information. What it covers, how it relates to the TA6 and material information rules, and where home moving is heading.',
    readingTime: '6 min read',
    updated: '2026-06-12',
  },
  // --- Industry & Reform (planned, plan numbers 42–46) ---
  { status: 'planned', slug: 'land-registry-title-data', category: 'industry-and-reform', planNumber: 42, title: 'What Land Registry Title Data Tells You Before You Offer', keyword: 'land registry title check', intent: 'Informational', phase: 4 },
  { status: 'planned', slug: 'home-buying-reform-roadmap', category: 'industry-and-reform', planNumber: 43, title: 'The Home Buying Reform Roadmap: What Actually Changes for Consumers', keyword: 'home buying reform uk', intent: 'Informational', phase: 4 },
  { status: 'planned', slug: 'property-data-trust-frameworks', category: 'industry-and-reform', planNumber: 44, title: 'Property Data Trust Frameworks Explained in Plain English', keyword: 'property data trust framework', intent: 'Informational', phase: 4 },
  { status: 'planned', slug: 'why-transactions-fall-through', category: 'industry-and-reform', planNumber: 45, title: 'Why One in Three Transactions Fall Through — and Which Points Are Fixable', keyword: 'why do house sales fall through', intent: 'Informational', phase: 1 },
  { status: 'planned', slug: 'upfront-searches', category: 'industry-and-reform', planNumber: 46, title: 'Upfront Searches: What Buying Them Before Listing Does to Your Timeline', keyword: 'upfront searches selling a house', intent: 'Commercial', phase: 4 },
];

export function getCategory(slug: string): ResourceCategory | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

/** Categories that have at least one published article (live pillars only). */
export function liveCategories(): ResourceCategory[] {
  return CATEGORIES.filter((c) =>
    RESOURCES.some((r) => r.category === c.slug && r.status === 'published'),
  );
}

export function publishedInCategory(slug: CategorySlug): PublishedArticle[] {
  return RESOURCES.filter(
    (r): r is PublishedArticle =>
      r.category === slug && r.status === 'published',
  );
}

export function getPublishedArticle(
  category: string,
  slug: string,
): PublishedArticle | undefined {
  return RESOURCES.find(
    (r): r is PublishedArticle =>
      r.status === 'published' && r.category === (category as CategorySlug) && r.slug === slug,
  );
}

/** Like getPublishedArticle but throws on a bad slug — catches registry drift at build time. */
export function getRequiredArticle(category: CategorySlug, slug: string): PublishedArticle {
  const article = getPublishedArticle(category, slug);
  if (!article) {
    throw new Error(`Unknown published article: ${category}/${slug}`);
  }
  return article;
}

/** Full article URL, e.g. /resources/selling/what-is-a-property-pack. */
export function articlePath(r: { category: CategorySlug; slug: string }): string {
  return `/resources/${r.category}/${r.slug}`;
}

/** Old /guides URLs that now live under /resources — used for redirects. */
export const LEGACY_GUIDE_ROUTES: Record<string, string> = {
  '/guides': '/resources',
  '/guides/what-is-a-property-pack': '/resources/selling/what-is-a-property-pack',
  '/guides/how-long-does-conveyancing-take':
    '/resources/buying/how-long-does-conveyancing-take',
  '/guides/baspi-explained': '/resources/industry-and-reform/baspi-explained',
  '/guides/property-searches-explained':
    '/resources/searches-and-legal/property-searches-explained',
  '/guides/property-information-forms-explained':
    '/resources/selling/property-information-forms-explained',
};
