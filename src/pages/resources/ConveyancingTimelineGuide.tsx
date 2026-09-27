// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * /resources/buying/how-long-does-conveyancing-take — realistic England & Wales
 * timeline, where the delays come from, and how to shorten them.
 * Prerender twin: scripts/prerender-resources.mjs (keep facts in sync).
 *
 * The one statistic on the page (Rightmove, 167 days as of March 2026) is
 * cited to its source. The week-by-week table is labelled as an illustration,
 * not data. Update both together when Rightmove publishes a newer figure.
 */

import React from 'react';
import ResourceLayout from './ResourceLayout';
import {
  Callout,
  GuideExternalLink,
  GuideH2,
  GuideH3,
  GuideLink,
  GuideList,
  GuideP,
  GuideTable,
  Term,
} from './guideElements';
import { getRequiredArticle } from './resourcesMeta';

const meta = getRequiredArticle('buying', 'how-long-does-conveyancing-take');

const RIGHTMOVE_SOURCE = 'https://www.rightmove.co.uk/guides/buyer/buying-a-property/offer-accepted/';

const LEDE =
  'On average, about five and a half months from sale agreed to completion. Here is where that figure comes from, a week-by-week timeline for England and Wales, what makes one sale take twice as long as another, and what you can do about it.';

const TIMELINE_ROWS: React.ReactNode[][] = [
  ['Week 1', 'Offer accepted, memorandum of sale issued, both sides instruct conveyancers and pass ID and anti-money-laundering checks.'],
  ['Weeks 1–3', 'Seller’s conveyancer sends the draft contract pack: title, TA6, TA10 (and TA7 for leasehold). Buyer orders searches and a survey, and applies for the mortgage.'],
  ['Weeks 2–6', 'Searches come back, at a speed set mostly by the council. Survey done. Lender values the property.'],
  ['Weeks 4–10', 'Buyer’s conveyancer raises enquiries and the seller answers them. Mortgage offer issued.'],
  ['Weeks 8–12', 'Everything is signed off, deposit paid, contracts exchanged. The sale is now legally binding.'],
  ['1–2 weeks after exchange', 'Completion: money moves, keys are released, the buyer is registered at HM Land Registry.'],
];

const ConveyancingTimelineGuide: React.FC = () => (
  <ResourceLayout meta={meta} lede={LEDE} productLink={{ to: '/register', lead: 'Every milestone in this timeline is tracked and time-stamped in a PropXchain transaction.', label: 'Start your transaction free' }}>
    <GuideH2>The quick answer</GuideH2>
    <GuideP>
      Rightmove reported that the average time from sale agreed to completion
      was <Term>167 days, about five and a half months</Term>, as of March 2026
      (<GuideExternalLink href={RIGHTMOVE_SOURCE}>Rightmove</GuideExternalLink>).
      That average covers every kind of sale, chains and leaseholds included.
    </GuideP>
    <GuideP>
      Conveyancers often quote 12 to 16 weeks for a simple freehold with no
      chain. Treat that as what a clean sale can achieve, not what most sales
      do. The gap between the two figures is almost entirely waiting: for
      searches, for lenders, for answers, and for the slowest link in the chain.
    </GuideP>

    <Callout label="At a glance">
      Average, all sales: about 5.5 months (Rightmove, March 2026). Clean,
      chain-free freehold: often around three months. Leasehold, long chains
      and slow councils: longer than average. Exchange to completion: usually
      one to two weeks.
    </Callout>

    <GuideH2>A realistic timeline, week by week</GuideH2>
    <GuideP>
      An illustration for a chain-free freehold bought with a mortgage, where
      everyone replies promptly. It is not a guarantee; each stage can stretch,
      and in a chain nobody exchanges until everybody can.
    </GuideP>
    <GuideTable
      caption="Illustrative conveyancing timeline for a chain-free freehold purchase in England and Wales"
      head={['When', 'What happens']}
      rows={TIMELINE_ROWS}
    />

    <GuideH2>The stages, in order</GuideH2>
    <GuideH3>1. Instruction and identity checks</GuideH3>
    <GuideP>
      Both sides appoint a conveyancer, sign terms, and complete identity and
      anti-money-laundering checks. Days if everyone responds quickly; weeks if
      paperwork drifts. Instructing a conveyancer when you list, not when you
      accept an offer, takes this stage off the critical path.
    </GuideP>

    <GuideH3>2. Draft contract and seller&apos;s forms</GuideH3>
    <GuideP>
      The seller&apos;s conveyancer obtains the title from HM Land Registry and
      prepares the draft contract pack, including the seller&apos;s TA6 and TA10
      (see <GuideLink to="/resources/selling/property-information-forms-explained">TA6, TA10 and TA7 explained</GuideLink>).
      If the seller prepared these in advance (see{' '}
      <GuideLink to="/resources/selling/what-is-a-property-pack">what is a sales pack</GuideLink>),
      this stage is nearly instant. If not, the clock runs while forms sit in an inbox.
    </GuideP>

    <GuideH3>3. Searches</GuideH3>
    <GuideP>
      The buyer&apos;s side orders local authority, drainage and water, and
      environmental searches (typically £50 to £450 as a set). See{' '}
      <GuideLink to="/resources/searches-and-legal/property-searches-explained">property searches explained</GuideLink>{' '}
      for what each one covers.
    </GuideP>

    <GuideH3>4. Survey and mortgage offer</GuideH3>
    <GuideP>
      The buyer commissions a survey and, if borrowing, waits for the lender to
      value the property and issue a formal mortgage offer. Lender timescales are
      largely outside everyone&apos;s control, which is why buyers with an
      agreement in principle move noticeably faster.
    </GuideP>

    <GuideH3>5. Enquiries</GuideH3>
    <GuideP>
      The buyer&apos;s conveyancer reviews everything and raises{' '}
      <Term>enquiries</Term>: written questions to the seller&apos;s side. Each
      round trip can take days or weeks, and an incomplete answer spawns another
      round. This is where transactions quietly lose a month or more.
    </GuideP>

    <GuideH3>6. Exchange of contracts</GuideH3>
    <GuideP>
      Once every enquiry is settled and the mortgage offer is in place, both
      sides sign and the conveyancers <Term>exchange contracts</Term>. The deal
      becomes legally binding and the completion date is fixed. In a chain,
      every transaction in the chain must exchange together.
    </GuideP>

    <GuideH3>7. Completion and registration</GuideH3>
    <GuideP>
      Usually one to two weeks after exchange (same-day is possible), the money
      moves, keys are released, and the buyer&apos;s conveyancer applies to HM
      Land Registry to register the new owner.
    </GuideP>

    <GuideH2>How long do conveyancing searches take?</GuideH2>
    <GuideP>
      Anything from a couple of days to several weeks. The local authority
      search sets the pace, and its turnaround depends on the council: some
      reply within days, others take weeks. Drainage, water and environmental
      searches are usually quicker. Searches are one of the most common single
      causes of delay and one of the easiest to start early, because nothing
      legally stops them being ordered before the other stages finish.
    </GuideP>

    <GuideH2>What makes one sale take longer than another</GuideH2>
    <GuideList
      items={[
        <><Term>No chain vs a chain.</Term> A first-time buyer purchasing an empty home can move as fast as the paperwork allows. In a chain, your sale moves at the speed of the slowest transaction connected to it.</>,
        <><Term>Freehold vs leasehold.</Term> Leasehold adds a management pack from the freeholder or managing agent (the TA7 and its supporting documents), which is chargeable and often slow to arrive.</>,
        <><Term>Cash vs mortgage.</Term> A cash buyer skips the lender&apos;s valuation and offer, which removes one of the stages nobody else can hurry.</>,
        <><Term>Prepared vs unprepared seller.</Term> A seller whose title, forms and certificates are ready before listing removes weeks from the start and cuts the number of enquiries later.</>,
      ]}
    />

    <Callout label="Where the weeks go">
      Very little of a conveyancing timeline is anyone actively working on your
      file. It is search backlogs, enquiry round trips, lender queues, and the
      slowest link in the chain setting the pace for everyone. The transactions
      that complete quickly are the ones where the waiting is attacked, not the
      legal work.
    </Callout>

    <GuideH2>What causes the big delays</GuideH2>
    <GuideList
      items={[
        <><Term>Chains.</Term> One slow buyer three links away stalls everybody.</>,
        <><Term>Slow searches.</Term> Council turnaround you cannot control, but you can control when they are ordered.</>,
        <><Term>Enquiry ping-pong.</Term> Vague or missing information up front guarantees more questions later, each with its own round-trip time.</>,
        <><Term>Leasehold paperwork.</Term> Management packs from freeholders and managing agents are chargeable and frequently slow to arrive.</>,
        <><Term>Mortgage hiccups.</Term> Expired offers, down-valuations, or a lender requesting more evidence late in the day.</>,
        <><Term>Nobody can see the whole picture.</Term> When updates travel by phone call between five parties, even a simple &quot;where are we?&quot; takes a day to answer, and problems are spotted late.</>,
      ]}
    />

    <GuideH2>How to speed it up</GuideH2>
    <GuideList
      items={[
        <><Term>Prepare before you list.</Term> Title pulled, TA6 and TA10 completed, certificates gathered. A prepared seller removes the slowest early stage entirely.</>,
        <><Term>Order searches early.</Term> Do not wait for milestones that do not legally depend on each other.</>,
        <><Term>Instruct your conveyancer at listing, not at offer.</Term> Onboarding and ID checks can be done while you market. If you have not chosen one yet, see <GuideLink to="/conveyancers">how the PropXchain panel works</GuideLink> (firms quote directly per transaction).</>,
        <><Term>Respond same-day.</Term> Enquiries, signatures and documents returned in hours rather than weeks compound across the whole timeline.</>,
        <><Term>Share one live view.</Term> When seller, buyer and conveyancers all see the same transaction state, chasing disappears and blockers surface the day they happen, not the week after.</>,
      ]}
    />
    <GuideP>
      The industry is moving the same way: the push for upfront information is
      about getting these facts in front of buyers at listing instead of weeks
      into the sale. See{' '}
      <GuideLink to="/resources/industry-and-reform/baspi-explained">BASPI explained</GuideLink>.
    </GuideP>

    <GuideH2>What about Scotland?</GuideH2>
    <GuideP>
      This guide covers England and Wales. Scotland has its own legal system:
      the seller provides a Home Report before marketing, and the sale is
      concluded through an exchange of letters called missives rather than an
      exchange of contracts, so its timeline and its bottlenecks are different.
    </GuideP>

    <GuideH2>Where PropXchain fits</GuideH2>
    <GuideP>
      PropXchain is built around getting rid of that waiting. Your transaction
      lives in one shared, real-time view: the HM Land Registry title is pulled
      when you start, your forms are guided and stored as you complete them,
      searches you order are tracked to the transaction, and every milestone is
      timestamped on-chain so nobody has to take anyone&apos;s word for where
      things stand. The Starter tier is free with no platform fee; the optional
      £75 AI co-pilot reads your title and search results in plain English and
      flags issues before they become enquiries. See{' '}
      <GuideLink to="/pricing">pricing</GuideLink> for the full breakdown, or
      start with{' '}
      <GuideLink to="/resources/selling/what-is-a-property-pack">the sales pack guide</GuideLink>{' '}
      to get ahead of the timeline before you list.
    </GuideP>
  </ResourceLayout>
);

export default ConveyancingTimelineGuide;
