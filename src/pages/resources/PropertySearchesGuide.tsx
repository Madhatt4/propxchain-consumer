// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * /resources/searches-and-legal/property-searches-explained — what each property search tells you,
 * why the list changes with location, what they cost, and how long they take and last.
 * Prerender twin: scripts/prerender-resources.mjs. The at-a-glance table, the
 * HMLR migration figure and the pack price come from searchesGuideData.mjs,
 * which both files import.
 *
 * Keep the existing GuideH2 ids: nothing in-app links to them today, but the
 * page has been public since June 2026 and outside links may.
 *
 * Product claims are checked against the code: OneSearch packs include an
 * environmental report (services/searchProviderData.ts), prices are the
 * provider's RRP shown before payment, and sellers order at stage seller-2.
 * Do not claim "no markup" here: PropXchain keeps the trade-to-RRP margin.
 */

import React from 'react';
import ResourceLayout from './ResourceLayout';
import { Callout, GuideExternalLink, GuideH2, GuideList, GuideLink, GuideP, GuideTable, Term } from './guideElements';
import { getRequiredArticle } from './resourcesMeta';
import { LocationDiagram, ValidityDiagram } from './searchDiagrams';
import { CORE_PACK_FROM, HMLR_ANNUAL_REPORT_URL, LLC_MIGRATION, SEARCHES_AT_A_GLANCE } from './searchesGuideData';

const meta = getRequiredArticle('searches-and-legal', 'property-searches-explained');

const LEDE =
  'Searches are the part of buying a house nobody explains. They arrive as a line on an invoice with an acronym attached, and most people pay without ever learning what they bought. Here is which searches are done when you buy a house, what each one tells you, how long they take, what they cost, and why the list is different for a house in Barnsley and a house in Bedfordshire.';

const GLANCE_ROWS: React.ReactNode[][] = SEARCHES_AT_A_GLANCE.map((s) => [s.name, s.tells, s.when, s.speed]);

const PropertySearchesGuide: React.FC = () => (
  <ResourceLayout meta={meta} lede={LEDE} productLink={{ to: '/sell-my-house', lead: 'In a PropXchain transaction, sellers can order searches before they list, so buyers see answers in days instead of weeks.', label: 'See how sellers start' }}>
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
      the garden before it releases the money.
    </GuideP>

    <GuideH2 id="which-searches">What searches are done when buying a house?</GuideH2>
    <GuideP>
      Four apply to almost every purchase in England and Wales. The rest depend on where the
      house is.
    </GuideP>
    <GuideTable
      caption="The property searches done when buying a house in England and Wales"
      head={['Search', 'What it tells you', 'When it is needed', 'How long it takes']}
      rows={GLANCE_ROWS}
    />

    <GuideH2 id="local-authority">Local authority search (LLC1 + CON29)</GuideH2>
    <GuideP>
      Two documents that travel together. The <Term>LLC1</Term> is a search of the local land
      charges register: financial obligations and restrictions that bind whoever owns the
      property, such as tree preservation orders, conservation area status or a council loan
      for improvements. The <Term>CON29</Term> answers the Law Society&apos;s standard questions
      about planning and building control history, roads, and notices the council has served.
    </GuideP>
    <GuideP>
      A second form, the <Term>CON29O</Term>, holds optional questions about things that only
      matter for some properties, such as common land, public paths or pipelines. Your
      conveyancer decides whether any are worth asking. Each council sets its own fees for
      these searches.
    </GuideP>
    <GuideP>
      Local land charges are moving from individual councils to one national register run by
      HM Land Registry. By its 2025–26 annual report, {LLC_MIGRATION.migrated} of{' '}
      {LLC_MIGRATION.total} councils had moved across, with the rest due by the end of{' '}
      {LLC_MIGRATION.targetYear} (
      <GuideExternalLink href={HMLR_ANNUAL_REPORT_URL}>HM Land Registry</GuideExternalLink>).
      Where a council has moved, the LLC1 part comes back much faster.
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

    <GuideH2 id="how-long">How long do local searches take?</GuideH2>
    <GuideP>
      Anything from a few days to several weeks, and the council is almost always the reason.
      The title register is instant, and drainage, water and environmental reports usually come
      back quickly. The local authority search depends on how quickly that council answers the
      CON29 questions and, until it moves to the national register, how it runs its local land
      charges. There is no official national figure, so treat any single number you see with
      caution.
    </GuideP>
    <GuideP>
      Because nothing legally stops searches being ordered early, the delay is also one of the
      few a seller can take off the timeline before a buyer appears (see{' '}
      <GuideLink to="/resources/buying/how-long-does-conveyancing-take">how long conveyancing takes</GuideLink>).
    </GuideP>

    <GuideH2 id="cost">How much do searches cost?</GuideH2>
    <GuideP>
      It depends on the council, the provider and what you add. On PropXchain, a OneSearch pack
      with the local authority, drainage and water, and environmental searches starts at{' '}
      <Term>{CORE_PACK_FROM} including VAT</Term>. Location-driven searches such as a coal report
      cost extra. Every price is the provider&apos;s published rate or a live quote for the
      property, and it is shown before you pay.
    </GuideP>

    <GuideH2 id="who-supplies">Who supplies what</GuideH2>
    <GuideP>
      No single organisation holds all the records. On PropXchain, OneSearch sells the core
      searches as a pack: local authority, drainage and water, and an environmental report.
      tmGroup quotes each property individually from a wider list, including environmental,
      coal, chancel and flood reports.
    </GuideP>
    <GuideP>
      Groundsure is a data company. It sells environmental, flood, planning and regional mining
      reports, as bundles or one at a time, for when you want more than a pack covers. It does
      not carry out local authority searches. Worth noting that the coal report,{' '}
      <Term>CON29M</Term>, is a different product from the <Term>CON29</Term> local authority
      enquiries despite the near-identical name.
    </GuideP>

    <GuideH2>Bundle, or one at a time?</GuideH2>
    <GuideP>
      A bundle is usually cheaper when you need most of what is in it, and worse value when you
      need two items out of six. PropXchain works out which searches your property actually needs
      from the postcode before showing you prices.
    </GuideP>
    <Callout label="Worth knowing">
      A search you do not need is not a safety net. It is a document nobody will read, and every
      provider will happily sell you one.
    </Callout>

    <GuideH2 id="cash">Do I need searches if I am buying with cash?</GuideH2>
    <GuideP>
      Not legally, and no lender will insist. But the searches exist to protect the buyer as much
      as the lender: a road scheme, an unpaid council charge or a contaminated plot becomes your
      problem the day you complete, however you paid. Most conveyancers will advise a cash buyer
      to order the core searches anyway, and skipping them can make the home harder to sell or
      mortgage later.
    </GuideP>

    <GuideH2 id="indemnity">Search indemnity insurance</GuideH2>
    <GuideP>
      A one-off insurance policy offered instead of some searches, usually the local authority
      search, when time is short. It covers certain financial losses from matters a search would
      have revealed. It does not tell you anything about the property, it usually stops covering
      you if you learn of the problem another way, and not every lender accepts it. It is a
      stopgap for speed, not a cheaper replacement for knowing.
    </GuideP>

    <GuideH2>How long they last</GuideH2>
    <ValidityDiagram />
    <GuideP>
      Most searches are treated as valid for six months. A chain that drags past that can mean
      paying for some of them twice. Some OneSearch packs on PropXchain include a refresh: the
      expiry is tracked and the refresh arranged before it lapses, taking validity to 12 months.
    </GuideP>
    <GuideList
      items={[
        'Order early — searches are one of the few delays a seller can remove before a buyer even appears.',
        'Nothing here replaces your conveyancer reading the results. Ordering is the easy half.',
      ]}
    />
  </ResourceLayout>
);

export default PropertySearchesGuide;
