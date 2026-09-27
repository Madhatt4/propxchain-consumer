// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * /resources/selling/ta6-form-explained — the TA6 Property Information Form
 * (6th edition): what changed, what each of the 15 sections asks, how to
 * answer, and how to fill it in on PropXchain.
 * Prerender twin: scripts/prerender-resources.mjs. The section table and the
 * edition facts come from ta6GuideData.mjs, which both files import.
 *
 * Product claims are checked against the code: the TA6 stepper is not
 * tier-gated (App.tsx route, PricingPage Starter list), "Export PDF" produces
 * PropXchain's own record of the answers rather than the official form, and
 * the pack share link redacts personal details (utils/packRedaction.ts).
 */

import React from 'react';
import ResourceLayout from './ResourceLayout';
import {
  Callout,
  GuideExternalLink,
  GuideH2,
  GuideLink,
  GuideList,
  GuideP,
  GuideTable,
  Term,
} from './guideElements';
import { getRequiredArticle } from './resourcesMeta';
import { LAW_SOCIETY_TA6_URL, REMOVED_SECTIONS, TA6_SECTIONS } from './ta6GuideData';

const meta = getRequiredArticle('selling', 'ta6-form-explained');

const LEDE =
  'The TA6 is the long form every seller in England and Wales fills in. The 6th edition became the standard on 30 March 2026, with 15 sections instead of 25. Here is what each section asks, what to have ready, and how to answer without creating problems for yourself later.';

const SECTION_ROWS: React.ReactNode[][] = TA6_SECTIONS.map((s) => [
  `${s.n}. ${s.title}`,
  s.asks,
  s.ready,
]);

const TA6FormGuide: React.FC = () => (
  <ResourceLayout meta={meta} lede={LEDE} productLink={{ to: '/register', lead: 'Fill in your TA6 answers online, section by section, free on the Starter tier.', label: 'Start your transaction free' }}>
    <GuideH2 id="what">What is the TA6 form?</GuideH2>
    <GuideP>
      The TA6 is the Law Society&apos;s <Term>Property Information Form</Term>.
      The seller fills it in to tell the buyer what they know about the home:
      boundaries, disputes, building work, guarantees, flooding, services and
      more. It is used for most sales of owner-occupied homes in England and
      Wales. It is not meant for new builds, and it may need adapting for
      auctions and part exchange.
    </GuideP>
    <GuideP>
      It usually arrives from your conveyancer once an offer is accepted, but
      the Law Society says it can be completed before a buyer is found. Doing
      it early is one of the simplest ways to take weeks off a sale (see{' '}
      <GuideLink to="/resources/buying/how-long-does-conveyancing-take">how long conveyancing takes</GuideLink>).
    </GuideP>

    <GuideH2 id="sixth-edition">The 6th edition: what changed in 2026</GuideH2>
    <GuideP>
      The TA6 (6th edition) replaced the 4th and 5th editions on 30 March
      2026. Conveyancing firms in the Law Society&apos;s Conveyancing Quality
      Scheme must use it for any sale they were instructed on from that date (
      <GuideExternalLink href={LAW_SOCIETY_TA6_URL}>Law Society</GuideExternalLink>).
    </GuideP>
    <GuideList
      items={[
        <><Term>15 sections, down from 25.</Term> The structure is closer to the 4th edition. Sections the Law Society lists as removed include: {REMOVED_SECTIONS.join(', ').toLowerCase()}.</>,
        <><Term>No EPC request.</Term> The Energy Performance Certificate is now handled by the estate agent at marketing.</>,
        <><Term>More &ldquo;not known&rdquo; options.</Term> More questions are phrased as &ldquo;are you aware&hellip;&rdquo;, where &ldquo;no&rdquo; means the same as &ldquo;not known&rdquo;.</>,
        <><Term>Clearer explanatory notes.</Term> The Law Society rewrote them after user testing found the old ones too dense to read.</>,
      ]}
    />

    <GuideH2 id="download">Can I download the TA6 as a free PDF?</GuideH2>
    <GuideP>
      Not the current edition, legitimately. The Law Society supplies the TA6
      through licensed third-party suppliers, and your conveyancer will
      normally send it to you. Free PDFs found online are often the 4th or
      5th edition, which suppliers have withdrawn and which conveyancers in
      the quality scheme can no longer use for new instructions. Filling in
      an old edition means doing the work twice.
    </GuideP>

    <GuideH2 id="sections">The 15 sections, one by one</GuideH2>
    <GuideP>
      A plain-English summary of each section and what to dig out before you
      start. It paraphrases the form; the official wording is what your
      answers are judged against.
    </GuideP>
    <GuideTable
      caption="The 15 sections of the TA6 Property Information Form (6th edition)"
      head={['Section', 'What it asks', 'Have ready']}
      rows={SECTION_ROWS}
    />

    <GuideH2 id="answering">How to answer without causing problems</GuideH2>
    <GuideP>
      A &ldquo;yes&rdquo; or &ldquo;no&rdquo; is a statement the buyer is
      entitled to rely on. If it turns out to be wrong and they relied on it,
      they may have a claim for misrepresentation, and that can follow you
      after completion. &ldquo;Not known&rdquo; is a legitimate answer when it
      is true, but you need honest grounds for giving it.
    </GuideP>
    <GuideList
      items={[
        <><Term>Answer from what you know.</Term> You are not expected to investigate, but do not guess. A confident wrong answer is worse than an honest &ldquo;not known&rdquo;.</>,
        <><Term>Disputes count even if they were settled.</Term> A long-running disagreement with a neighbour counts even if nothing formal happened.</>,
        <><Term>Paperwork matters as much as the work.</Term> Missing certificates for windows, extensions or electrics are common. Say so rather than leaving a blank; your conveyancer can advise on options.</>,
        <><Term>Knotweed and flooding are about the property.</Term> Answer for the home itself, not the postcode.</>,
      ]}
    />
    <Callout label="Before you start">
      Gather the certificates and guarantees first. Most of the time spent on a
      TA6 is looking for documents, and most of the enquiries it triggers are
      about documents that were not attached.
    </Callout>

    <GuideH2 id="related">TA6, TA10 and TA7</GuideH2>
    <GuideP>
      The TA6 usually travels with the TA10 (fittings and contents) and, for
      leasehold homes, the TA7 (leasehold information). See{' '}
      <GuideLink to="/resources/selling/property-information-forms-explained">TA6, TA10 and TA7 explained</GuideLink>{' '}
      for how the three fit together, and{' '}
      <GuideLink to="/resources/selling/what-is-a-property-pack">what is a sales pack</GuideLink>{' '}
      for everything else a buyer will ask for.
    </GuideP>

    <GuideH2 id="propxchain">Filling in your TA6 on PropXchain</GuideH2>
    <GuideP>
      On the free Starter tier you can fill in your TA6 answers online, one
      section at a time, with a plain-English help card above each section.
      Each section saves as you finish it. When you are done you can export a PDF
      record of them for your conveyancer, and share them with buyers and
      their conveyancers through a read-only link that removes personal
      details.
    </GuideP>
    <GuideP>
      PropXchain&apos;s version follows the 6th edition section by section and
      paraphrases the questions. The official Law Society wording is what
      governs your answers, and your conveyancer may still ask you to sign
      the official form through their supplier. See{' '}
      <GuideLink to="/pricing">pricing</GuideLink> for what is included in each tier.
    </GuideP>
  </ResourceLayout>
);

export default TA6FormGuide;
