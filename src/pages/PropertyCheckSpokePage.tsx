// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * A topic page of the free property check (/flood-risk-check,
 * /listed-building-check). It answers one search question in depth, then
 * hands the address to /property-check, which runs the full report, so there
 * is one report to maintain rather than one per topic. The address travels in
 * router state, never the URL, to keep it out of analytics page paths.
 *
 * Copy comes from propertyCheckSpokesData.mjs, which the prerender also
 * reads, so the crawler's HTML and this page cannot drift apart.
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AddressCheckForm, type CheckedAddress } from '@/components/property/AddressCheckForm';
import { FREE_REPORT_PATH } from '@/config/registration';

import MarketingShell from './marketing/MarketingShell';
import { BAND_CLS, BODY_CLS, H1_CLS, H2_CLS, H3_CLS, LINK_CLS, MUTED_CLS } from './marketing/propertyCheckStyles';
import { FLOOD_RISK_SPOKE, HERITAGE_SPOKE } from './marketing/propertyCheckSpokesData';
import type { PropertyCheckSpoke } from './marketing/propertyCheckSpokesData';

const SPOKES = { flood: FLOOD_RISK_SPOKE, heritage: HERITAGE_SPOKE } as const;

export type SpokeKey = keyof typeof SPOKES;

function FaqList({ spoke }: { spoke: PropertyCheckSpoke }): JSX.Element {
  return (
    <section className={`${BAND_CLS} bg-[#FFFFFF] dark:bg-[#0F172A]`}>
      <div className="mx-auto max-w-[760px] px-6 py-20">
        <h2 className={H2_CLS}>Questions</h2>
        <div className="mt-8 space-y-8">
          {spoke.faqs.map((faq) => (
            <div key={faq.q}>
              <h3 className={H3_CLS}>{faq.q}</h3>
              <p className={`mt-2 ${MUTED_CLS}`}>{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const PropertyCheckSpokePage: React.FC<{ topic: SpokeKey }> = ({ topic }) => {
  const spoke = SPOKES[topic];
  const navigate = useNavigate();

  const handleCheck = (address: CheckedAddress): void => {
    navigate(FREE_REPORT_PATH, { state: { address } });
  };

  return (
    <MarketingShell>
      <section className="mx-auto max-w-[860px] px-6 py-16 sm:py-24">
        <h1 className={H1_CLS}>{spoke.h1}</h1>
        <p className={`mt-6 max-w-2xl text-lg ${MUTED_CLS}`}>{spoke.intro}</p>
        <AddressCheckForm idPrefix={`spoke-${topic}`} onCheck={handleCheck} />
      </section>

      {spoke.sections.map((section) => (
        <section key={section.id} id={section.id} className={BAND_CLS}>
          <div className="mx-auto max-w-[760px] px-6 py-16">
            <h2 className={H2_CLS}>{section.heading}</h2>
            {section.paragraphs.map((p) => (
              <p key={p} className={`mt-5 ${BODY_CLS}`}>{p}</p>
            ))}
          </div>
        </section>
      ))}

      <FaqList spoke={spoke} />

      <section className={`${BAND_CLS} bg-[#F0F5F0] dark:bg-[#0D1526]`}>
        <div className="mx-auto max-w-[760px] px-6 py-16">
          <p className={BODY_CLS}>
            The same check also covers planning, sold prices, the energy rating and more.{' '}
            <Link to={FREE_REPORT_PATH} className={LINK_CLS}>
              See the full free property check
            </Link>
            .
          </p>
        </div>
      </section>
    </MarketingShell>
  );
};

export default PropertyCheckSpokePage;
