// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * /resources/selling/what-is-a-property-pack — what a sales pack (upfront property
 * information; historically "property pack") is, what goes in it, and why
 * it speeds up a sale. Retitled to the roadmap's term 2026-08-14; the URL
 * keeps its equity.
 * Prerender twin: scripts/prerender-guides.mjs (keep facts in sync).
 */

import React from 'react';
import ResourceLayout from './ResourceLayout';
import { Callout, GuideH2, GuideH3, GuideLink, GuideList, GuideP, Term } from './guideElements';
import { getRequiredArticle } from './resourcesMeta';

const meta = getRequiredArticle('selling', 'what-is-a-property-pack');

const LEDE =
  'Most house sales start with a listing and end with a scramble for documents. A sales pack flips that order: the information a buyer will eventually demand is gathered before anyone makes an offer. Here is what goes in one, and why it changes how fast you sell.';

const PropertyPackGuide: React.FC = () => (
  <ResourceLayout meta={meta} lede={LEDE} productLink={{ to: '/sell-my-house', lead: 'Gathering all of this before you list is exactly what PropXchain does.', label: 'See how sellers start' }}>
    <GuideH2>The idea in one paragraph</GuideH2>
    <GuideP>
      A <Term>sales pack</Term> — the term used in the government&apos;s June
      2026 Home Buying and Selling Reform Roadmap; you will also hear{' '}
      <Term>property pack</Term>, <Term>upfront information</Term>,{' '}
      <Term>material information</Term> or a <Term>home information pack</Term>{' '}
      in older articles — is a bundle of the
      documents and facts about your property that every buyer&apos;s
      conveyancer and lender will ask for sooner or later. In a traditional
      sale they are collected <em>after</em> an offer is accepted, one request
      at a time, while everyone waits. In a pack-led sale the seller collects
      them <em>before</em> listing, so a serious buyer can see the full
      picture on day one.
    </GuideP>

    <GuideH2>What goes in a sales pack</GuideH2>
    <GuideH3>Title register and title plan</GuideH3>
    <GuideP>
      The official HM Land Registry record of who owns the property, the
      registered boundaries, and anything attached to the title: mortgages,
      restrictions, rights of way, covenants. It is the legal starting point
      for every conveyancer, and pulling it early surfaces problems (an old
      restriction, an unexpected charge) while there is still time to fix
      them calmly.
    </GuideP>

    <GuideH3>Property searches</GuideH3>
    <GuideP>
      Searches are enquiries made to public bodies about the property and the
      land around it. The usual core set:
    </GuideP>
    <GuideList
      items={[
        <><Term>Local authority search:</Term> planning permissions, building control history, road schemes, enforcement notices.</>,
        <><Term>Drainage and water search:</Term> whether the property is connected to mains water and sewerage, and where the pipes run.</>,
        <><Term>Environmental search:</Term> flood risk, contaminated land, ground stability, past industrial use nearby.</>,
      ]}
    />
    <GuideP>
      Searches typically cost around £50 to £450 as a set. Some sellers commission them upfront; others wait
      for the buyer to order. Either way, they answer questions a lender will
      insist on before releasing funds.
    </GuideP>

    <GuideH3>Seller&apos;s property information (TA6 and material information)</GuideH3>
    <GuideP>
      The <Term>TA6</Term> is the Law Society&apos;s property information
      form: disputes with neighbours, alterations and whether they had
      consent, guarantees, boundaries, flooding, parking, who supplies the
      utilities. Alongside it sits the broader push for{' '}
      <Term>material information</Term> in listings, so facts that would
      affect a buyer&apos;s decision (tenure, council tax band, leasehold
      costs, known risks) are disclosed at the point of marketing rather
      than weeks later. The industry blueprint for this is the BASPI form,
      which we cover in{' '}
      <GuideLink to="/resources/industry-and-reform/baspi-explained">BASPI explained</GuideLink>.
    </GuideP>

    <GuideH3>Energy Performance Certificate (EPC)</GuideH3>
    <GuideP>
      A legal requirement when marketing a property in England and Wales. It
      rates energy efficiency from A to G and is valid for ten years, so many
      homes already have one on the national register.
    </GuideP>

    <GuideH3>The supporting cast</GuideH3>
    <GuideList
      items={[
        <>Fittings and contents form (<Term>TA10</Term>): what stays and what goes.</>,
        <>Guarantees and certificates: FENSA for windows, gas and electrical safety records, damp-proofing or roofing warranties, building regulations sign-off for past work.</>,
        <>Leasehold information where relevant: the lease itself, ground rent and service charge details, and the management pack from the freeholder or managing agent.</>,
      ]}
    />

    <Callout label="Key fact">
      Nothing in a sales pack is extra work invented for the seller. Every
      item is something the buyer&apos;s side will require anyway; the pack
      just moves the effort to the start of the sale, when it can run in
      parallel with finding a buyer instead of holding up the chain.
    </Callout>

    <GuideH2>Why upfront information sells houses faster</GuideH2>
    <GuideP>
      Conveyancing delay is mostly waiting: for a form to come back, for a
      search result, for an answer to an enquiry that prompts another
      enquiry. When the information exists before the offer, three things
      change:
    </GuideP>
    <GuideList
      items={[
        <><Term>Fewer surprises, fewer fall-throughs.</Term> Sales most often collapse when something unexpected surfaces late: a missing consent, an unclear boundary, a leasehold cost the buyer had not priced in. A pack surfaces it on day one, while it is a discussion rather than a crisis.</>,
        <><Term>Serious offers from informed buyers.</Term> A buyer who has read the title, the searches and the TA6 before offering is far less likely to renegotiate or walk away after the survey.</>,
        <><Term>Conveyancers start with answers.</Term> The legal work begins from a complete file instead of a blank one, which shortens the enquiry stage that eats most of the calendar. See <GuideLink to="/resources/buying/how-long-does-conveyancing-take">how long conveyancing takes</GuideLink> for where the weeks actually go.</>,
      ]}
    />

    <GuideH2>How PropXchain assembles your pack</GuideH2>
    <GuideP>
      PropXchain is built around exactly this idea: the pack is the product
      of simply starting your transaction properly.
    </GuideP>
    <GuideList
      items={[
        <>Add your address, then hit the Title button to check who owns YOUR property — £7 pulls the official <Term>HM Land Registry title</Term> and names the registered owner.</>,
        <>Guided, plain-English <Term>TA6 and TA10 forms</Term> that auto-save as you go.</>,
        <>Order your <Term>searches</Term> from the provider you choose and pay the rate shown up front.</>,
        <>Everything is stored in one shared transaction view with an on-chain audit trail, so your buyer and your conveyancer see the same pack you do, the moment each piece arrives.</>,
      ]}
    />
    <GuideP>
      All of that is on the free Starter tier; there is no platform fee. If
      you want help reading what you have gathered, the optional £75 AI
      co-pilot reads your title and search results in plain English, flags
      the issues that matter, and turns the real complexity of your
      transaction into a tailored conveyancer quote request. Details on{' '}
      <GuideLink to="/pricing">the pricing page</GuideLink>, and there is a
      full walkthrough of a seller-led sale on{' '}
      <GuideLink to="/sellers">the sellers page</GuideLink>.
    </GuideP>
  </ResourceLayout>
);

export default PropertyPackGuide;
