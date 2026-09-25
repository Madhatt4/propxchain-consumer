// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * /resources/buying/how-long-does-conveyancing-take — realistic England & Wales
 * timeline, where the delays come from, and how to shorten them.
 * Prerender twin: scripts/prerender-guides.mjs (keep facts in sync).
 */

import React from 'react';
import ResourceLayout from './ResourceLayout';
import { Callout, GuideH2, GuideH3, GuideLink, GuideList, GuideP, Term } from './guideElements';
import { getRequiredArticle } from './resourcesMeta';

const meta = getRequiredArticle('buying', 'how-long-does-conveyancing-take');

const LEDE =
  'Ask three people how long conveyancing takes and you will get three different answers, because the honest one is "it depends what goes wrong". Here is a realistic stage-by-stage timeline for England and Wales, the delays that genuinely cost weeks, and what you can do about them.';

const ConveyancingTimelineGuide: React.FC = () => (
  <ResourceLayout meta={meta} lede={LEDE} productLink={{ to: '/register', lead: 'Every milestone in this timeline is tracked and time-stamped in a PropXchain transaction.', label: 'Start your transaction free' }}>
    <GuideH2>The honest answer</GuideH2>
    <GuideP>
      For a straightforward freehold sale or purchase with a willing buyer
      and seller, conveyancing in England and Wales typically takes{' '}
      <Term>several months from offer acceptance to completion</Term>. A
      clean, well-prepared transaction can move considerably faster; a long
      chain or a complicated leasehold can take far longer. The variation is
      the point: almost none of the calendar is legal work taking its
      natural course. Most of it is waiting.
    </GuideP>

    <GuideH2>The stages, in order</GuideH2>
    <GuideH3>1. Instruction and identity checks</GuideH3>
    <GuideP>
      Both sides appoint a conveyancer, sign terms, and complete identity
      and anti-money-laundering checks. Days if everyone responds quickly;
      weeks if paperwork drifts.
    </GuideP>

    <GuideH3>2. Draft contract and seller&apos;s forms</GuideH3>
    <GuideP>
      The seller&apos;s conveyancer obtains the title from HM Land Registry
      and prepares the draft contract pack, including the seller&apos;s
      completed TA6 and TA10 forms. If the seller has prepared these in
      advance (see{' '}
      <GuideLink to="/resources/selling/what-is-a-property-pack">what is a sales pack</GuideLink>
      ), this stage is nearly instant. If not, the clock runs while forms
      sit in an inbox.
    </GuideP>

    <GuideH3>3. Searches</GuideH3>
    <GuideP>
      The buyer&apos;s side orders local authority, drainage and water, and
      environmental searches (typically £50 to £450 as a set). Turnaround varies enormously by council: some return
      a local search in days, others take weeks. This is one of the most
      common single sources of delay, and one of the easiest to start early.
    </GuideP>

    <GuideH3>4. Survey and mortgage offer</GuideH3>
    <GuideP>
      The buyer commissions a survey and, if borrowing, waits for the lender
      to value the property and issue a formal mortgage offer. Lender
      timescales are largely outside everyone&apos;s control, which is why
      buyers with an agreement in principle move noticeably faster.
    </GuideP>

    <GuideH3>5. Enquiries</GuideH3>
    <GuideP>
      The buyer&apos;s conveyancer reviews everything and raises{' '}
      <Term>enquiries</Term>: written questions to the seller&apos;s side.
      Each round trip can take days or weeks, and an incomplete answer
      spawns another round. This ping-pong is where transactions quietly
      lose a month or more.
    </GuideP>

    <GuideH3>6. Exchange of contracts</GuideH3>
    <GuideP>
      Once every enquiry is settled and the mortgage offer is in place, both
      sides sign and the conveyancers <Term>exchange contracts</Term>. The
      deal becomes legally binding and the completion date is fixed. In a
      chain, every transaction in the chain must exchange together.
    </GuideP>

    <GuideH3>7. Completion and registration</GuideH3>
    <GuideP>
      Usually one to two weeks after exchange (same-day is possible), the
      money moves, keys are released, and the buyer&apos;s conveyancer
      submits the application to HM Land Registry to register the new owner.
    </GuideP>

    <Callout label="Where the weeks go">
      Very little of a conveyancing timeline is anyone actively working on
      your file. It is search backlogs, enquiry round trips, lender queues,
      and the slowest link in the chain setting the pace for everyone. The
      transactions that complete quickly are the ones where the waiting is
      attacked, not the legal work.
    </Callout>

    <GuideH2>What causes the big delays</GuideH2>
    <GuideList
      items={[
        <><Term>Chains.</Term> Your sale moves at the speed of the slowest transaction connected to it. One slow buyer three links away stalls everybody.</>,
        <><Term>Slow searches.</Term> Council turnaround you cannot control, but you can control when they are ordered.</>,
        <><Term>Enquiry ping-pong.</Term> Vague or missing information up front guarantees more questions later, each with its own round-trip time.</>,
        <><Term>Leasehold paperwork.</Term> Management packs from freeholders and managing agents are chargeable and frequently slow to arrive.</>,
        <><Term>Mortgage hiccups.</Term> Expired offers, down-valuations, or a lender requesting more evidence late in the day.</>,
        <><Term>Nobody can see the whole picture.</Term> When updates travel by phone call between five parties, even a simple "where are we?" takes a day to answer, and problems are spotted late.</>,
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

    <GuideH2>Where PropXchain fits</GuideH2>
    <GuideP>
      PropXchain is built around that last point. Your transaction lives in
      one shared, real-time view: the HM Land Registry title is pulled when
      you start, your forms are guided and stored as you complete them,
      searches you order are tracked to the transaction, and every milestone
      is timestamped on-chain so nobody has to take anyone&apos;s word for
      where things stand. The Starter tier is free with no platform fee; the
      optional £75 AI co-pilot reads your title and search results in plain
      English and flags issues before they become enquiries. See{' '}
      <GuideLink to="/pricing">pricing</GuideLink> for the full breakdown, or
      start with{' '}
      <GuideLink to="/resources/selling/what-is-a-property-pack">the sales pack guide</GuideLink>{' '}
      to get ahead of the timeline before you list.
    </GuideP>
  </ResourceLayout>
);

export default ConveyancingTimelineGuide;
