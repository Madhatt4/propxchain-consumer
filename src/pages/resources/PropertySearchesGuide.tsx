// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * /resources/searches-and-legal/property-searches-explained — what each property search tells you,
 * why the list changes with location, and how long they stay valid.
 * Prerender twin: scripts/prerender-guides.mjs (keep facts in sync).
 *
 * The GuideH2 ids here are deep-link targets for the searches explainer card
 * (src/components/searches/explainer/) — renaming one breaks that link.
 */

import React from 'react';
import ResourceLayout from './ResourceLayout';
import { Callout, GuideH2, GuideList, GuideP, Term } from './guideElements';
import { getRequiredArticle } from './resourcesMeta';
import { LocationDiagram, ValidityDiagram } from './searchDiagrams';

const meta = getRequiredArticle('searches-and-legal', 'property-searches-explained');

const LEDE =
  'Searches are the part of buying a house nobody explains. They arrive as a line on an invoice with an acronym attached, and most people pay without ever learning what they bought. Here is what each one actually does, and why the list is different for a house in Barnsley and a house in Bedfordshire.';

const PropertySearchesGuide: React.FC = () => (
  <ResourceLayout meta={meta} lede={LEDE} productLink={{ to: '/sell-my-house', lead: 'In a PropXchain transaction, searches can be ordered before you list, so buyers see answers in days instead of weeks.', label: 'See how sellers start' }}>
    <GuideH2>What a search actually is</GuideH2>
    <GuideP>
      A <Term>property search</Term> is a question put to an organisation that holds records
      about land — the council, the water company, the Coal Authority — and the written answer
      that comes back. It is not an inspection and nobody visits the house. It is a records
      check.
    </GuideP>
    <GuideP>
      The party really asking is usually the buyer&apos;s lender. A mortgage is secured against
      the property, so the lender wants to know the council has no plans to drive a road through
      the garden before it releases the money. That is why searches are effectively compulsory on
      a mortgaged purchase and optional on a cash one.
    </GuideP>

    <GuideH2 id="local-authority">Local authority search (LLC1 + CON29)</GuideH2>
    <GuideP>
      Two documents that travel together. The <Term>LLC1</Term> lists charges registered against
      the property — financial obligations and restrictions that bind whoever owns it. The{' '}
      <Term>CON29</Term> answers a standard set of questions about planning permissions, building
      control, nearby road schemes and public footpaths.
    </GuideP>

    <GuideH2 id="drainage-water">Drainage and water (CON29DW)</GuideH2>
    <GuideP>
      Confirms whether the property is connected to public water and sewers, or relies on a
      private supply or septic tank, and whether a public sewer runs under the garden — which
      matters if you ever want to build over it.
    </GuideP>

    <GuideH2 id="environmental">Environmental search</GuideH2>
    <GuideP>
      Checks contaminated land, landfill history, flood risk and radon. Under contaminated land
      rules a current owner can be liable for cleaning up pollution somebody else caused, which is
      the real reason this one is on the list.
    </GuideP>

    <GuideH2 id="title">Land Registry title search</GuideH2>
    <GuideP>
      The official register and plan: who owns it, where the boundaries run, what rights cross it,
      and what charges are secured against it.
    </GuideP>

    <GuideH2>Why the list changes with location</GuideH2>
    <LocationDiagram />
    <GuideP>
      The four above apply almost everywhere. The rest depend on what the ground has been used
      for.
    </GuideP>

    <GuideH2 id="coal-mining">Coal mining (CON29M)</GuideH2>
    <GuideP>
      For properties over former coalfields. Checks recorded shafts, worked seams, subsidence
      claims and mine gas.
    </GuideP>

    <GuideH2 id="brine">Brine and salt extraction</GuideH2>
    <GuideP>
      Cheshire&apos;s salt field, chiefly. Brine pumping dissolves rock underground and can cause
      serious ground movement.
    </GuideP>

    <GuideH2 id="tin-mining">Tin and metalliferous mining</GuideH2>
    <GuideP>
      Cornwall and west Devon, where centuries of tin working left shafts that predate any central
      record.
    </GuideP>

    <GuideH2 id="chancel">Chancel repair liability</GuideH2>
    <GuideP>
      An old obligation binding some properties to contribute to repairing a parish church
      chancel. Rare, cheap to check, expensive to discover late.
    </GuideP>

    <GuideH2 id="who-supplies">Who supplies what</GuideH2>
    <GuideP>
      No single company does all of it, which surprises most people. The{' '}
      <Term>local authority search</Term> and <Term>drainage and water</Term> come from a search
      provider with a direct line to the council and the water company — OneSearch and tmGroup
      both do this, and sell them together as a pack.
    </GuideP>
    <GuideP>
      The environmental, flood, planning and mining reports come from a data company instead.
      Groundsure is the one PropXchain works with, and they are bought individually and added on
      top of whichever pack you choose. They do not carry out local authority searches. Worth
      noting that the coal report, <Term>CON29M</Term>, is a different product from the{' '}
      <Term>CON29</Term> local authority enquiries despite the near-identical name.
    </GuideP>

    <GuideH2>Bundle, or one at a time?</GuideH2>
    <GuideP>
      Within a single provider, a bundle is usually cheaper when you need most of what is in it,
      and worse value when you need two items out of six. Across providers the question does not
      really arise — they are doing different jobs, so you are not choosing between them so much
      as choosing what to add. PropXchain works out which searches your property actually needs
      from the postcode before showing you prices.
    </GuideP>
    <Callout label="Worth knowing">
      A search you do not need is not a safety net. It is a document nobody will read, and every
      provider will happily sell you one.
    </Callout>

    <GuideH2>How long they take, and how long they last</GuideH2>
    <ValidityDiagram />
    <GuideP>
      Turnarounds run from instant for the title register to ten working days for a slow council.
      Most searches are treated as valid for six months.
    </GuideP>
    <GuideList
      items={[
        'Order early — searches are one of the few delays a seller can remove before a buyer even appears.',
        'A chain that drags past six months can mean paying for some searches twice.',
        'Nothing here replaces your conveyancer reading the results. Ordering is the easy half.',
      ]}
    />
  </ResourceLayout>
);

export default PropertySearchesGuide;
