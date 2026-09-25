// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * /resources/selling/property-information-forms-explained — the TA6, TA10 and TA7
 * forms, what each asks, and why the answers carry legal weight.
 * Prerender twin: scripts/prerender-guides.mjs (keep facts in sync).
 *
 * The GuideH2 ids here are deep-link targets for the property information
 * explainer card (src/components/propertyInfo/) — renaming one breaks that
 * link.
 */

import React from 'react';
import ResourceLayout from './ResourceLayout';
import { Callout, GuideH2, GuideH3, GuideLink, GuideList, GuideP, Term } from './guideElements';
import { getRequiredArticle } from './resourcesMeta';

const meta = getRequiredArticle('selling', 'property-information-forms-explained');

const LEDE =
  'Three forms stand between accepting an offer and a buyer who stops asking questions. They look like paperwork and they are not: what you write on them is a set of statements your buyer is entitled to rely on, and getting one wrong can follow you long after you have moved out.';

const PropertyInfoFormsGuide: React.FC = () => (
  <ResourceLayout meta={meta} lede={LEDE} productLink={{ to: '/register', lead: 'The TA6 and TA10 in a PropXchain transaction are filled in once, with AI help, and tracked from there.', label: 'Start your transaction free' }}>
    <GuideH2 id="why">Why these forms exist</GuideH2>
    <GuideP>
      English property sales run on <Term>caveat emptor</Term> — buyer beware. The seller is not
      obliged to volunteer everything they know, so the buyer&apos;s solicitor asks instead. These
      forms are the industry&apos;s standard set of questions, published by the Law Society, so
      that every sale asks the same things in the same order.
    </GuideP>
    <GuideP>
      What happens next is the part people miss. Your answers become the basis of the{' '}
      <Term>enquiries</Term> the buyer&apos;s solicitor raises. Thin or evasive answers do not make
      the questions go away — they turn one form into three weeks of correspondence.
    </GuideP>

    <GuideH2 id="ta6">TA6 — Property Information</GuideH2>
    <GuideP>
      The long one. Boundaries and who maintains them, disputes and complaints, notices you have
      received, alterations and whether they had consent, guarantees, services, and rights of way.
    </GuideP>
    <GuideH3>The questions people get wrong</GuideH3>
    <GuideList
      items={[
        'Disputes: a running disagreement with a neighbour counts even if nothing formal ever happened. "We do not speak" is a dispute.',
        'Alterations: a conservatory, a knocked-through wall or replacement windows all need the paperwork. If you inherited the work from a previous owner and have no certificates, say that rather than leaving it blank.',
        'Flooding: this asks about the property, not the postcode. A flooded garden in 2019 belongs here.',
        'Japanese knotweed: "no" means you have checked and are confident. If you are unsure what it looks like, "not known" is the honest answer.',
      ]}
    />

    <GuideH2 id="ta10">TA10 — Fittings and Contents</GuideH2>
    <GuideP>
      Room by room, what stays and what goes. It reads as trivial and it is the single most common
      source of completion-day arguments — light fittings taken down on the morning of the move,
      curtains the buyer assumed were included, a shed that turned out to be going with the seller.
    </GuideP>
    <GuideP>
      Anything you intend to take, mark as excluded. Anything you would rather leave than move,
      mark as included — buyers routinely pay a little more for white goods rather than buy their
      own.
    </GuideP>

    <GuideH2 id="ta7">TA7 — Leasehold Information</GuideH2>
    <GuideP>
      Leasehold and share-of-freehold sales only. Service charges, ground rent, the managing agent,
      the lease terms and any major works planned.
    </GuideP>
    <Callout label="Start this one early">
      Most of these answers are not yours to give — they come from the freeholder or managing
      agent, who will charge a fee and take their time. Leasehold sales stall here more than
      anywhere else in the process, and requesting the management pack the week you list rather
      than the week you accept an offer routinely saves a fortnight.
    </Callout>

    <GuideH2 id="binding">What &ldquo;legally binding&rdquo; actually means here</GuideH2>
    <GuideP>
      Your answers are <Term>representations</Term>: statements the buyer relies on when deciding
      to proceed and what to pay. If one turns out to be untrue and the buyer relied on it, they
      may have a claim for <Term>misrepresentation</Term> — and that survives completion. This is
      not a form you can tidy up afterwards.
    </GuideP>
    <GuideP>
      That sounds alarming and the remedy is simple: answer what you know, and where you do not
      know, say so. &ldquo;Not known&rdquo; is a permitted answer on these forms and it is not a
      weakness. What creates liability is a confident answer that turns out to be wrong, not an
      honest admission of uncertainty.
    </GuideP>

    <GuideH2 id="documents">What to gather before you start</GuideH2>
    <GuideList
      items={[
        'FENSA or CERTASS certificates for replacement windows and doors',
        'Building regulations completion certificates for structural work, and planning permissions where they were needed',
        'Guarantees and their paperwork: damp proofing, timber treatment, roofing, cavity wall insulation, underpinning',
        'Boiler service records, gas safety and electrical installation certificates',
        'For leasehold: the lease itself, recent service charge statements and any Section 20 notices about major works',
      ]}
    />
    <GuideP>
      Gathering these first turns the forms from an afternoon of guessing into an hour of copying.
      For how these forms fit the wider push toward upfront information, see{' '}
      <GuideLink to="/resources/industry-and-reform/baspi-explained">BASPI explained</GuideLink>, and for everything a
      buyer eventually needs, <GuideLink to="/resources/selling/what-is-a-property-pack">what is a sales
      pack</GuideLink>.
    </GuideP>
  </ResourceLayout>
);

export default PropertyInfoFormsGuide;
