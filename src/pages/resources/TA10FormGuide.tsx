// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * /resources/selling/ta10-form-explained — the TA10 Fittings and Contents
 * Form: what it is, which edition is current, the items that cause most
 * completion-day disputes, and how to fill it in on PropXchain.
 * Prerender twin: scripts/prerender-resources.mjs. The edition facts and the
 * flashpoints table come from ta10GuideData.mjs, which both files import.
 *
 * Product claims are checked against the code: the TA10 is a room-by-room
 * checklist with an included/excluded toggle and a note per item, custom
 * items per room, an outdoor list (components/forms/TA10Form.tsx), it is in
 * the free list (constants/pricing.ts), "Export PDF" is PropXchain's own
 * record rather than the official form, and the pack share link redacts it
 * (services/packShare.service.ts -> redactTa10ForSharing).
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
import { LAW_SOCIETY_TA_FORMS_URL, TA10_EDITION, TA10_FLASHPOINTS } from './ta10GuideData';

const meta = getRequiredArticle('selling', 'ta10-form-explained');

const LEDE =
  'The TA10 is the form where a seller lists what stays and what goes. It looks like the easy one, and it is behind more completion-day arguments than any other. Here is what it covers, the items that cause trouble, and how to fill it in so nobody is surprised when the keys change hands.';

const FLASHPOINT_ROWS: React.ReactNode[][] = TA10_FLASHPOINTS.map((f) => [f.item, f.why, f.tip]);

const TA10FormGuide: React.FC = () => (
  <ResourceLayout meta={meta} lede={LEDE} productLink={{ to: '/register', lead: 'Fill in your TA10 room by room online, free.', label: 'Start your transaction free' }}>
    <GuideH2 id="what">What is the TA10 form?</GuideH2>
    <GuideP>
      The TA10 is the Law Society&apos;s <Term>Fittings and Contents Form</Term>.
      The seller uses it to say which items are included in the sale price and
      which are excluded: light fittings, curtains, appliances, carpets, garden
      items and anything else a buyer might expect to find. The Law Society
      says you will likely need one for every sale and purchase.
    </GuideP>
    <GuideP>
      It travels with the{' '}
      <GuideLink to="/resources/selling/ta6-form-explained">TA6 property information form</GuideLink>,
      and your conveyancer usually sends both at once. It normally goes out
      with the contract papers, so the buyer is entitled to expect exactly what
      you listed.
    </GuideP>

    <GuideH2 id="edition">Which edition is current?</GuideH2>
    <GuideP>
      The current form is the TA10 ({TA10_EDITION.edition}, {TA10_EDITION.year}) (
      <GuideExternalLink href={LAW_SOCIETY_TA_FORMS_URL}>Law Society</GuideExternalLink>).
      When the TA6 and TA7 were replaced on 30 March 2026, the TA10 was not, so
      the form you are sent now is the same one sellers have used for years.
    </GuideP>
    <GuideP>
      The Law Society does not make its transaction forms available to the
      public. Your conveyancer gets the TA10 through a licensed supplier and
      sends it to you, so there is no need to hunt for a PDF.
    </GuideP>

    <GuideH2 id="fixtures">Fixtures, fittings and why the form exists</GuideH2>
    <GuideP>
      As a rough rule, <Term>fixtures</Term> are attached to the building and
      stay with it, and <Term>fittings</Term> are free-standing and go with
      you. The trouble is that plenty of items sit in between: a curtain pole,
      a fitted wardrobe, a wall-mounted TV bracket. The TA10 removes the
      guesswork by asking you to decide, item by item, and write it down.
    </GuideP>

    <GuideH2 id="filling-in">How to fill it in</GuideH2>
    <GuideList
      items={[
        <><Term>Go room by room.</Term> Walk round the house with the form, including the loft, garage and garden, rather than filling it in from memory.</>,
        <><Term>Mark every item.</Term> If you are taking it, mark it excluded. If you are leaving it, mark it included. A blank is what starts an argument.</>,
        <><Term>Name anything unusual.</Term> A hot tub, a home EV charger or a bespoke light fitting needs its own line.</>,
        <><Term>Say if something is for sale.</Term> If you would sell an item you are taking, such as a fridge or garden furniture, say so; your conveyancer can agree a price with the buyer&apos;s side.</>,
      ]}
    />

    <GuideH2 id="flashpoints">The items that cause the most disputes</GuideH2>
    <GuideTable
      caption="TA10 items that most often cause a dispute"
      head={['Item', 'Why it causes trouble', 'What to do']}
      rows={FLASHPOINT_ROWS}
    />
    <Callout label="Changing your mind">
      Tell your conveyancer straight away, before exchange of contracts if you
      can. Once contracts are exchanged the list is part of what you agreed,
      and removing an item you marked as included can give the buyer a claim
      against you.
    </Callout>

    <GuideH2 id="related">TA10, TA6 and TA7</GuideH2>
    <GuideP>
      The TA10 is one of three forms most sellers fill in. See{' '}
      <GuideLink to="/resources/selling/property-information-forms-explained">TA6, TA10 and TA7 explained</GuideLink>{' '}
      for how they fit together, and{' '}
      <GuideLink to="/resources/selling/what-is-a-property-pack">what is a sales pack</GuideLink>{' '}
      for everything else a buyer will ask for.
    </GuideP>

    <GuideH2 id="propxchain">Filling in your TA10 on PropXchain</GuideH2>
    <GuideP>
      On PropXchain the TA10 is a room-by-room checklist, free, with common
      items already listed for each room and an outdoor list for the garden.
      You mark each item included or excluded, add a note on condition or
      model, and add anything that is not on the list. You can export a PDF
      record for your conveyancer, and the answers go into your property pack,
      which you can share with buyers through a read-only link that removes
      personal details.
    </GuideP>
    <GuideP>
      PropXchain&apos;s checklist is its own record of your answers, not the
      official Law Society form, and your conveyancer may still ask you to
      sign the official TA10 through their supplier. See{' '}
      <GuideLink to="/pricing">pricing</GuideLink> for what is free and what is paid per item.
    </GuideP>
  </ResourceLayout>
);

export default TA10FormGuide;
