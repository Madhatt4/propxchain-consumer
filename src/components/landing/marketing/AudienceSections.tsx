// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The five audience sections (Sellers · Buyers · Conveyancers · Developers ·
 * Estate agents), each rendered through the shared AudienceSection layout with
 * its own supporting visual card.
 */

import type { ReactNode } from 'react';

import { IS_REGISTRATION_OPEN } from '@/config/registration';

import { AudienceSection } from './AudienceSection';

interface AudienceSectionsProps {
  onScrollTo: (id: string) => void;
}

/** Uppercase DM Mono card label. */
function CardLabel({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div
      style={{
        fontFamily: "'DM Mono', monospace",
        textTransform: 'uppercase',
        fontSize: '0.65rem',
        letterSpacing: '0.1em',
        color: 'var(--fg-3)',
        marginBottom: '1rem',
      }}
    >
      {children}
    </div>
  );
}

/** Geist Mono "label … status" row. */
function StatusRow({ label, status, tone }: { label: string; status: string; tone: 'teal' | 'sage' }): JSX.Element {
  return (
    <div className="num flex justify-between" style={{ fontSize: '0.78rem' }}>
      <span style={{ color: 'var(--fg-2)' }}>{label}</span>
      <span style={{ color: tone === 'teal' ? 'var(--t)' : 'var(--sage)' }}>{status}</span>
    </div>
  );
}

function SellersSide(): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div className="card card-teal" style={{ padding: '1.5rem' }}>
        <CardLabel>Typical saving</CardLabel>
        <div className="num" style={{ fontSize: '2.6rem', fontWeight: 700, color: 'var(--t)', lineHeight: 1 }}>
          ↑ £2,000
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--fg-3)', lineHeight: 1.6, margin: '0.8rem 0 0' }}>
          Free platform + your conveyancer&apos;s quote, versus £1,500–2,500 traditional per side.
        </p>
      </div>
      <div className="card" style={{ padding: '1.5rem' }}>
        <CardLabel>Milestones</CardLabel>
        <div className="flex flex-col gap-2">
          <StatusRow label="TA6 completed" status="✓ on-chain" tone="teal" />
          <StatusRow label="Searches ordered" status="✓ on-chain" tone="teal" />
          <StatusRow label="Enquiries answered" status="⧗ awaiting" tone="sage" />
        </div>
      </div>
    </div>
  );
}

function BuyersSide(): JSX.Element {
  const rows: Array<{ text: string; tone: 'teal' | 'sage' }> = [
    { text: "Seller's forms — done and verified", tone: 'teal' },
    { text: 'Search results — the day they arrive', tone: 'teal' },
    { text: 'Exchange readiness — no guessing', tone: 'sage' },
  ];
  return (
    <div className="card" style={{ padding: '1.75rem' }}>
      <CardLabel>What you see, live</CardLabel>
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.text} className="flex gap-3 items-center">
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 9999,
                flexShrink: 0,
                background: row.tone === 'teal' ? 'var(--t)' : 'var(--sage)',
              }}
            />
            <span style={{ fontSize: '0.9rem', color: 'var(--fg-2)' }}>{row.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConveyancersSide(): JSX.Element {
  const rows = [
    'HMLR title summary, pulled',
    'Searches ordered & attached',
    'TA6 / TA10 completed by seller',
    'AI-surfaced likely enquiries',
  ];
  return (
    <div className="card" style={{ padding: '1.75rem' }}>
      <CardLabel>The referral brief</CardLabel>
      <div className="flex flex-col gap-3" style={{ fontSize: '0.88rem' }}>
        {rows.map((row) => (
          <div key={row} className="flex gap-3">
            <span style={{ color: 'var(--t)' }}>→</span>
            <span style={{ color: 'var(--fg-2)' }}>{row}</span>
          </div>
        ))}
      </div>
      <div
        className="flex items-baseline gap-2"
        style={{ borderTop: '1px solid var(--card-border)', marginTop: '1.25rem', paddingTop: '1.25rem' }}
      >
        <span className="num" style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--t)' }}>
          You quote
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--fg-3)' }}>per transaction — your fee, your call</span>
      </div>
    </div>
  );
}

function AgentsSide(): JSX.Element {
  const rows: Array<{ label: string; status: string; tone: 'teal' | 'sage' }> = [
    { label: '14 Elm Road', status: '✓ exchanged', tone: 'teal' },
    { label: '7 Mill Lane', status: '⧗ enquiries', tone: 'sage' },
    { label: '22 Church St', status: '⧗ searches', tone: 'sage' },
    { label: '3 Orchard Close', status: '✓ completed', tone: 'teal' },
  ];
  return (
    <div className="card" style={{ padding: '1.75rem' }}>
      <CardLabel>Your book, live</CardLabel>
      <div className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <StatusRow key={row.label} label={row.label} status={row.status} tone={row.tone} />
        ))}
      </div>
    </div>
  );
}

function DevelopersImage(): JSX.Element {
  return (
    <img
      src="/images/dev-kanban-hero.jpg"
      alt="PropXchain Dev pipeline dashboard"
      style={{
        width: '100%',
        aspectRatio: '16 / 10',
        objectFit: 'cover',
        borderRadius: 12,
        border: '1px solid var(--card-border)',
      }}
    />
  );
}

export function AudienceSections({ onScrollTo }: AudienceSectionsProps): JSX.Element {
  return (
    <>
      <AudienceSection
        id="sellers"
        background="ink2"
        eyebrow="🏠 For sellers"
        titleLead="The seller is"
        titleKey="in charge now."
        lead="List your property, complete your TA6 and TA10 yourself with guidance, order your own searches at a price shown up front — and watch every milestone land on-chain in real time."
        points={[
          'Start free — pick your own providers and see every price before you commit. No platform fee.',
          'AI co-pilot premium tier coming soon — reads your HMLR title and search results in plain English.',
          'No "we\'re waiting for searches" excuses — you order, you receive, you\'re in control.',
          'Save around £2,000 against the £1,500–2,500 traditional cost per side.',
        ]}
        ctas={
          IS_REGISTRATION_OPEN
            ? [
                { label: 'Create your free account', variant: 'primary', to: '/register' },
                { label: 'Get your free report', variant: 'ghost' },
              ]
            : [{ label: 'Get your free Home Mover Report', variant: 'primary' }]
        }
        side={<SellersSide />}
        onScrollTo={onScrollTo}
      />

      <AudienceSection
        id="buyers"
        background="ink"
        eyebrow="👁️ For buyers"
        titleLead="See everything."
        titleKey="Pay nothing."
        lead="Buyers use PropXchain completely free. The same on-chain milestones the seller sees, you see — so you know the sale is real, moving, and how close exchange actually is."
        points={[
          'Free — no fee, ever, for buyers.',
          "30%+ of sales fall through — spot a stalled transaction before you've spent thousands.",
          "Deposit and completion monies held in your conveyancer's regulated client account.",
        ]}
        ctas={[
          // The label has to move with the destination, not just the link.
          // "Create a free buyer account" pointed at the report form for
          // months; keeping that label while sign-ups are shut would leave
          // the same broken promise with a tidier implementation behind it.
          IS_REGISTRATION_OPEN
            ? { label: 'Create a free buyer account', variant: 'ghost', to: '/register' }
            : { label: 'Get your free report', variant: 'ghost' },
        ]}
        side={<BuyersSide />}
        sideFirst
        onScrollTo={onScrollTo}
      />

      <AudienceSection
        id="conveyancers"
        background="ink2"
        eyebrow="⚖️ For conveyancers"
        titleLead="You quote from"
        titleKey="a clean brief."
        lead="When a referral lands, the brief already contains the HM Land Registry title summary, the searches the seller has ordered, plain-language party documents, and the AI-surfaced list of likely enquiries. You decide whether to quote with the facts in front of you — not after three rounds of email."
        points={[
          "No referral fee — we don't charge you, and we don't pay agents or introducers.",
          'CLC practice ID is all you need — we autofill the rest from the public register.',
          'Free to join. No case management software to learn, no subscription — you stay on your stack.',
        ]}
        ctas={[{ label: 'Apply to the panel', variant: 'primary', to: '/register/conveyancer' }]}
        side={<ConveyancersSide />}
        onScrollTo={onScrollTo}
      />

      <AudienceSection
        id="developers"
        background="ink"
        eyebrow="🏗️ For developers & builders"
        titleLead="Track every plot."
        titleKey="Hit every completion."
        lead={
          'Twelve plots means twelve transactions, twelve solicitors, twelve exchange dates — and half your ' +
          'week on the phone asking "where are we?". PropXchain Dev is the pipeline dashboard the big ' +
          'housebuilders built in-house, sized for sites under 50 plots.'
        }
        points={[
          'The whole site on one screen — every plot, every conveyancing stage.',
          'Import your plot list once; buyers and solicitors slot into the same pipeline.',
          'On-chain audit trail for every transaction on the site.',
        ]}
        ctas={[
          { label: 'Create your developer account', variant: 'primary', to: '/register/developer' },
          { label: 'Book a 20-min demo', variant: 'ghost' },
        ]}
        side={<DevelopersImage />}
        sideFirst
        onScrollTo={onScrollTo}
      />

      <AudienceSection
        id="agents"
        background="ink2"
        eyebrow="🏡 For estate agents"
        titleLead="Stop chasing."
        titleKey="Start completing."
        lead="Your listing populates the seller's dashboard directly — no re-keying. Then every milestone of the sale is visible to you in real time, so progression calls take seconds, not afternoons."
        points={[
          'Live sales progression across your whole book — one screen.',
          "Fewer fall-throughs — stalls surface early, while they're still fixable.",
          "Free for agents — you're a party to the transaction, not a customer.",
        ]}
        ctas={[{ label: 'Partner with PropXchain', variant: 'primary', to: '/partners' }]}
        side={<AgentsSide />}
        onScrollTo={onScrollTo}
      />
    </>
  );
}
