// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Content for the cinematic marketing landing page. Copy is verbatim from the
 * approved design reference (_design-reference/landing.html) — do not paraphrase.
 */

/** In-page sections the nav links, in the header and the footer, scroll to. */
export const NAV_LINKS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'sellers', label: 'Sellers' },
  { id: 'buyers', label: 'Buyers' },
  { id: 'conveyancers', label: 'Conveyancers' },
  { id: 'developers', label: 'Developers' },
  { id: 'agents', label: 'Agents' },
  { id: 'pricing', label: 'Pricing' },
];

export interface ProblemStat {
  /** Pre-formatted number; `sup` renders as a raised glyph (e.g. the "+" on 30%). */
  value: string;
  sup?: string;
  label: string;
  body: string;
}

export const PROBLEM_STATS: ProblemStat[] = [
  {
    value: '20–24',
    label: 'Weeks to complete',
    body: 'Most of that time is spent waiting — for solicitors to chase each other by post and email.',
  },
  {
    value: '30%',
    sup: '+',
    label: 'Of sales fall through',
    body: 'Deals collapse late — after thousands have already been spent on searches and legal work.',
  },
  {
    value: '£1.5–2.5k',
    label: 'Typical cost, per side',
    body: 'For a process that is largely the same paperwork, moved between the same desks.',
  },
];

export interface Step {
  glyph: string;
  num: string;
  title: string;
  body: string;
}

export const STEPS: Step[] = [
  {
    glyph: '🏠',
    num: '01',
    title: 'List your property',
    body: 'Add the details once, or import the estate agent listing. Then hit the Title button to check who owns YOUR property — £7 for the official HM Land Registry record.',
  },
  {
    glyph: '📋',
    num: '02',
    title: 'Complete your forms',
    body: 'TA6 and TA10, done yourself with guidance. No gatekeeping, no jargon.',
  },
  {
    glyph: '🔍',
    num: '03',
    title: 'Order your searches',
    body: 'Local, drainage and environmental — you pay, you receive, you’re in control. No "We are waiting for searches" excuses.',
  },
  {
    glyph: '⛓️',
    num: '04',
    title: 'Track every milestone',
    body: 'Each step recorded on-chain, visible to everyone who needs to see it, in real time.',
  },
  {
    glyph: '📜',
    num: '05',
    title: 'Exchange with confidence',
    body: 'Legally valid e-signature. (coming soon)',
  },
  {
    glyph: '🔑',
    num: '06',
    title: 'Complete and register',
    body: 'Filed directly with HM Land Registry through the Business Gateway. Keys in hand.',
  },
];

export interface AudienceCard {
  /** Section id the card scrolls to. */
  id: string;
  glyph: string;
  name: string;
  line: string;
  cta: string;
}

export const AUDIENCE_CARDS: AudienceCard[] = [
  { id: 'sellers', glyph: '🏠', name: 'Sellers', line: 'Run your own sale. Save around £2,000.', cta: 'Take charge' },
  { id: 'buyers', glyph: '👁️', name: 'Buyers', line: 'Watch the transaction live. Completely free.', cta: 'See it live' },
  { id: 'conveyancers', glyph: '⚖️', name: 'Conveyancers', line: 'Referrals with a clean brief. You quote.', cta: 'Join the panel' },
  { id: 'developers', glyph: '🏗️', name: 'Developers', line: 'Every plot tracked. Every completion hit.', cta: 'See the pipeline' },
  { id: 'agents', glyph: '🏡', name: 'Estate agents', line: 'Sales progression without the phone calls.', cta: 'Partner up' },
];

export interface Feature {
  glyph: string;
  title: string;
  body: string;
  /** Highlighted (teal) card — the AI guide. */
  teal?: boolean;
}

export const FEATURES: Feature[] = [
  {
    glyph: '⛓️',
    title: 'Recorded on the Internet Computer',
    body: 'Every milestone is written to the ICP blockchain — an immutable, shared source of truth.',
  },
  {
    glyph: '🔒',
    title: 'Your files stay on your device',
    body: 'Only SHA-256 hashes go on-chain. Private documents never leave your control. GDPR-compliant by design.',
  },
  {
    glyph: '✍️',
    title: 'Legally valid exchange',
    body: 'This is done by your chosen Conveyancer, full legal weight for exchange of contracts in England & Wales.',
  },
  {
    glyph: '💰',
    title: 'Client funds with your conveyancer',
    body: 'Deposit and completion monies are handled by your chosen Conveyancer through their regulated client account, monitored at every step.',
  },
  {
    glyph: '🏛️',
    title: 'HM Land Registry integration',
    body: 'A direct connection to the Business Gateway. Hit the Title button when you list — £7 pulls the official record and names the registered owner.',
  },
  {
    glyph: '🤖',
    title: 'AI guide',
    body: 'Walks you through each step, so you always know what happens next.',
    teal: true,
  },
];

/** The MCP connector address customers paste into their assistant. */
export const MCP_CONNECTOR_URL = 'https://mcp.propxchain.com/mcp';

export interface Assistant {
  name: string;
  /**
   * `available` only once a real connection from that assistant has been proven
   * against the live connector. A pricing-style claim that isn't true yet is
   * exactly what the 17 Sep copy audit removed from this site.
   */
  status: 'available' | 'coming-soon' | 'developers';
  statusLabel: string;
  body: string;
  /** Show the connector address on this card. */
  showsAddress?: boolean;
  link?: { label: string; path: string };
}

export const ASSISTANTS: Assistant[] = [
  {
    name: 'Claude',
    status: 'available',
    statusLabel: 'Available now',
    body: 'Add a custom connector in Claude with this address, then approve it with your PropXchain email and a one-time code.',
    showsAddress: true,
  },
  {
    name: 'ChatGPT',
    status: 'coming-soon',
    statusLabel: 'Coming soon',
    body: 'We are testing PropXchain with ChatGPT custom connectors now.',
  },
  {
    name: 'Building your own agent?',
    status: 'developers',
    statusLabel: 'For developers',
    body: 'How sign-in works, what each of the 18 tools does, and the limits that apply.',
    link: { label: 'Read the developer guide', path: '/api' },
  },
];

export interface PricingTier {
  name: string;
  sub: string;
  price: string;
  /** Suffix shown next to the price (e.g. "per transaction"). */
  priceNote?: string;
  /** Where the CTA routes. A '/register' destination falls back to the
   *  report capture section while sign-ups are closed — see
   *  config/registration.ts. Omit to always scroll to the report. */
  ctaPath?: string;
  features: string[];
  ctaLabel: string;
  /** Highlighted "Popular" tier. */
  featured?: boolean;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    name: 'Starter',
    sub: 'Free for everyone. Pick your own providers and see every price up front. No platform fee.',
    price: 'Free',
    priceNote: 'for all parties',
    features: [
      'Transaction tracking with on-chain audit',
      'HM Land Registry title pull — £7, names the registered owner',
      'Document vault and verification',
      'Conveyancer panel access',
    ],
    ctaLabel: 'Get started free',
    ctaPath: '/register',
    featured: true,
  },
  {
    name: 'Premium',
    sub: 'An AI co-pilot for the whole transaction — on top of everything in Starter.',
    price: '£75',
    priceNote: 'per transaction · coming soon',
    features: [
      'Everything in Starter',
      'AI reads your HMLR title in plain English',
      'AI reads your search results, issues flagged',
      'Complexity-aware conveyancer quote request',
      'AI next-step cards + priority support',
    ],
    ctaLabel: 'Get notified',
  },
  {
    name: 'Enterprise',
    sub: 'Volume, bespoke integrations, SLA, dedicated account manager.',
    price: 'Custom',
    features: [
      'Everything in Premium',
      'API access and white-label',
      'Dedicated account manager',
      'SSO, audit logs, SLA',
    ],
    ctaLabel: 'Contact sales',
    ctaPath: '/partners',
  },
];
