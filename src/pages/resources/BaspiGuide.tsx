// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * /resources/industry-and-reform/baspi-explained — the Buyer's and Seller's Property
 * Information form, its relationship to the TA6 and material
 * information rules, and where upfront information is heading.
 * Prerender twin: scripts/prerender-guides.mjs (keep facts in sync).
 */

import React from 'react';
import ResourceLayout from './ResourceLayout';
import { Callout, GuideH2, GuideH3, GuideLink, GuideList, GuideP, Term } from './guideElements';
import { getRequiredArticle } from './resourcesMeta';

const meta = getRequiredArticle('industry-and-reform', 'baspi-explained');

const LEDE =
  'BASPI is one of those acronyms the property industry throws around as if everyone was born knowing it. It matters because it is the closest thing home moving has to a blueprint for upfront information: one form, completed once, answering the questions every buyer eventually asks.';

const BaspiGuide: React.FC = () => (
  <ResourceLayout meta={meta} lede={LEDE} productLink={{ to: '/how-it-works', lead: 'PropXchain collects your property information upfront, the way BASPI argues every transaction should.', label: 'See how it works' }}>
    <GuideH2>What BASPI stands for</GuideH2>
    <GuideP>
      <Term>BASPI</Term> is the{' '}
      <Term>Buyer&apos;s and Seller&apos;s Property Information</Term> form.
      It was developed by the <Term>Home Buying and Selling Group</Term>{' '}
      (HBSG), a cross-industry group of conveyancers, estate agents,
      lenders, surveyors and proptech firms working with government to make
      home moving faster and less prone to collapse. The BASPI&apos;s
      ambition is simple: capture all the information about a property{' '}
      <em>once</em>, at the start of marketing, in a single dataset that
      every party in the transaction can rely on.
    </GuideP>

    <GuideH2>What the form covers</GuideH2>
    <GuideP>The BASPI is organised into two parts:</GuideP>
    <GuideH3>Part 1: what the seller knows</GuideH3>
    <GuideList
      items={[
        <>Ownership and tenure: freehold, leasehold, shared ownership, and who legally owns the property.</>,
        <>Disputes, complaints and notices affecting the property.</>,
        <>Alterations and building work, and whether consents and certificates exist.</>,
        <>Specialist issues: flooding, Japanese knotweed, asbestos, drainage, rights of way.</>,
        <>Leasehold detail where relevant: ground rent, service charges, the managing agent.</>,
        <>Utilities, services, parking, council tax band and other practical facts a buyer needs.</>,
      ]}
    />
    <GuideH3>Part 2: the legal pack</GuideH3>
    <GuideList
      items={[
        <>Title information and the documents supporting it.</>,
        <>Energy Performance Certificate and other required certificates.</>,
        <>Guarantees, warranties and planning documentation.</>,
      ]}
    />
    <GuideP>
      Part 1 is the seller&apos;s own disclosure; Part 2 is the supporting
      evidence a conveyancer assembles. Together they amount to the same
      thing we describe in{' '}
      <GuideLink to="/resources/selling/what-is-a-property-pack">what is a sales pack</GuideLink>
      : everything a buyer&apos;s side needs, gathered before an offer
      rather than after it.
    </GuideP>

    <GuideH2>How BASPI relates to the TA6</GuideH2>
    <GuideP>
      The <Term>TA6</Term> is the Law Society&apos;s property information
      form, the document sellers have traditionally completed for their
      conveyancer <em>after</em> a sale is agreed. The two overlap heavily
      by design: the BASPI was built as the umbrella dataset for the whole
      industry, and more recent editions of the TA6 have moved in the same
      direction, aligning the questions sellers answer with the material
      information a listing is expected to disclose. In practice, a seller
      who has completed a BASPI-shaped dataset has already answered
      substantially what the TA6 asks; the difference is <em>when</em>. The
      BASPI belongs at the point of listing, the TA6 traditionally arrives
      weeks later, and every week of difference is a week of conveyancing
      time saved or lost (see{' '}
      <GuideLink to="/resources/buying/how-long-does-conveyancing-take">how long conveyancing takes</GuideLink>
      ).
    </GuideP>

    <GuideH2>Material information: Parts A, B and C</GuideH2>
    <GuideP>
      Alongside the BASPI sits the consumer-protection side of upfront
      information. Guidance published by{' '}
      <Term>National Trading Standards</Term> (through its Estate and
      Letting Agency Team, NTSELAT) set out what estate agents should
      disclose in property listings, in three escalating parts:
    </GuideP>
    <GuideList
      items={[
        <><Term>Part A:</Term> information material to every property: price, tenure, council tax band, and for leaseholds the ground rent and service charges.</>,
        <><Term>Part B:</Term> information that applies to most properties: utilities, heating, broadband, parking, building safety.</>,
        <><Term>Part C:</Term> information that applies where relevant: flood risk, restrictive covenants, rights of way, accessibility, coastal erosion.</>,
      ]}
    />
    <GuideP>
      The legal footing for disclosure has since moved to the{' '}
      <Term>Digital Markets, Competition and Consumers Act 2024</Term>,
      which replaced the older consumer protection regulations that the
      guidance was written under. The direction of travel has not changed:
      omitting information a buyer needs is treated as a consumer-protection
      issue, not a sales tactic, and the A/B/C framing remains the clearest
      map of what buyers should expect to see upfront.
    </GuideP>

    <Callout label="The thread connecting it all">
      BASPI, the TA6 and the material information rules are three views of
      one idea: a buyer should not have to agree a price before learning
      basic facts about the property. The industry is converging on
      disclosure at the point of marketing, and sellers who prepare early
      are simply ahead of where the rules are heading.
    </Callout>

    <GuideH2>Where this is all heading</GuideH2>
    <GuideP>
      The same group behind the BASPI also backs the{' '}
      <Term>Property Data Trust Framework</Term>, a data standard that lets
      verified property information move digitally between platforms,
      agents, conveyancers and lenders instead of being retyped at every
      step. The destination is a transaction where information is collected
      once, verified at source, and trusted by everyone downstream.
    </GuideP>
    <GuideP>
      That is the model PropXchain is built on. When you start a sale, the
      guided forms capture your property information once, in plain English;
      one hit of the Title button pulls your official HM Land Registry
      title for £7 and names the registered owner; and everything
      lives in one shared view with an on-chain audit trail, so your buyer
      and conveyancer rely on the same verified record rather than asking
      you the same questions twice. The Starter tier is free with no
      platform fee, and the optional £75 AI co-pilot reads your title and
      searches in plain English and tailors your conveyancer quote request.
      See <GuideLink to="/pricing">pricing</GuideLink>, or start with{' '}
      <GuideLink to="/sellers">how a seller-led sale works</GuideLink>.
    </GuideP>
  </ResourceLayout>
);

export default BaspiGuide;
