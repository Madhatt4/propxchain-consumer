// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { AddressCheckForm, type CheckedAddress } from '@/components/property/AddressCheckForm';
import { LaunchListOptIn } from '@/components/property/LaunchListOptIn';
import { PropertyIntelligenceCard } from '@/components/transaction/PropertyIntelligenceCard';

import MarketingShell from './marketing/MarketingShell';
import { BAND_CLS, BODY_CLS, H1_CLS, H2_CLS, LINK_CLS, MUTED_CLS } from './marketing/propertyCheckStyles';
import {
  PROPERTY_CHECK_COVERS,
  PROPERTY_CHECK_FAQS,
  PROPERTY_CHECK_HERO,
  PROPERTY_CHECK_SECTIONS,
} from './marketing/propertyCheckData';

/**
 * The React page behind /property-check: the free Home Mover Report as a
 * standalone, indexable tool.
 *
 * Why it exists: the report used to live only inside the homepage, behind a
 * name-and-email form, so search engines had no page to rank it on, while
 * flood-risk, listed-building and conservation-area checks are some of the
 * most-searched pre-purchase questions. Here the report shows instantly and
 * the email is an optional step after it.
 *
 * All copy comes from propertyCheckData.mjs, which the prerender also reads,
 * so the crawler's HTML and this page cannot drift apart.
 */

const GUIDES: ReadonlyArray<{ to: string; label: string }> = [
  { to: '/resources/searches-and-legal/property-searches-explained', label: 'Property searches explained' },
  { to: '/resources/buying/how-long-does-conveyancing-take', label: 'How long conveyancing takes' },
  { to: '/resources/selling/ta6-form-explained', label: 'The TA6 form explained' },
];

function CoversList(): JSX.Element {
  return (
    <ul className="mt-8 grid gap-6 sm:grid-cols-2">
      {PROPERTY_CHECK_COVERS.map((item) => (
        <li key={item.label}>
          <p className={BODY_CLS}>
            <strong className="font-semibold">{item.label}</strong>
          </p>
          <p className={`mt-1 ${MUTED_CLS}`}>{item.body}</p>
        </li>
      ))}
    </ul>
  );
}

function CheckResult({ address }: { address: CheckedAddress }): JSX.Element {
  return (
    <div className="space-y-8">
      <PropertyIntelligenceCard
        postcode={address.postcode}
        addressLine={address.houseNumber}
        uprn={address.uprn}
        downloadable
      />
      <div className="rounded-lg border border-[#E5E7EB] bg-white p-6 dark:border-[#1E293B] dark:bg-[#0F172A]">
        <LaunchListOptIn address={address} />
      </div>
      <p className={MUTED_CLS}>
        Selling or buying this property?{' '}
        <Link to="/register" className="font-medium text-[#0D9488] underline dark:text-[#14B8A6]">
          Start your transaction free
        </Link>{' '}
        and the same checks run inside your transaction.
      </p>
    </div>
  );
}

/**
 * The homepage hero hands its address over in router state, never the query
 * string, so a house number and postcode stay out of analytics page URLs.
 */
function addressFromState(state: unknown): CheckedAddress | null {
  const candidate = (state as { address?: Partial<CheckedAddress> } | null)?.address;
  if (typeof candidate?.postcode !== 'string' || typeof candidate.houseNumber !== 'string') return null;
  if (!candidate.postcode.trim() || !candidate.houseNumber.trim()) return null;
  const uprn = typeof candidate.uprn === 'string' && /^\d{1,12}$/.test(candidate.uprn) ? candidate.uprn : undefined;
  return { postcode: candidate.postcode, houseNumber: candidate.houseNumber, ...(uprn ? { uprn } : {}) };
}

const PropertyCheckPage: React.FC = () => {
  const location = useLocation();
  const [address, setAddress] = useState<CheckedAddress | null>(() => addressFromState(location.state));
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (address) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [address]);

  return (
    <MarketingShell>
      <section className="mx-auto max-w-[860px] px-6 py-16 sm:py-24">
        <h1 className={H1_CLS}>
          {PROPERTY_CHECK_HERO.h1}
        </h1>
        <p className={`mt-6 max-w-2xl text-lg ${MUTED_CLS}`}>{PROPERTY_CHECK_HERO.intro}</p>
        <AddressCheckForm onCheck={setAddress} />
      </section>

      {address && (
        <section ref={resultRef} className={BAND_CLS} aria-label="Your property check">
          <div className="mx-auto max-w-[960px] px-6 py-12">
            {/* key: a second address mounts a fresh card rather than mixing two reports. */}
            <CheckResult key={`${address.uprn ?? address.houseNumber}|${address.postcode}`} address={address} />
          </div>
        </section>
      )}

      <section className={`${BAND_CLS} bg-[#FFFFFF] dark:bg-[#0F172A]`}>
        <div className="mx-auto max-w-[860px] px-6 py-20">
          <h2 className={H2_CLS}>What the check covers</h2>
          <CoversList />
        </div>
      </section>

      {PROPERTY_CHECK_SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className={BAND_CLS}>
          <div className="mx-auto max-w-[760px] px-6 py-20">
            <h2 className={H2_CLS}>{section.heading}</h2>
            {section.paragraphs.map((p) => (
              <p key={p} className={`mt-5 ${BODY_CLS}`}>{p}</p>
            ))}
            {section.more && (
              <p className="mt-5">
                <Link to={section.more.to} className={LINK_CLS}>
                  {section.more.label}
                </Link>
              </p>
            )}
          </div>
        </section>
      ))}

      <section className={`${BAND_CLS} bg-[#FFFFFF] dark:bg-[#0F172A]`}>
        <div className="mx-auto max-w-[760px] px-6 py-20">
          <h2 className={H2_CLS}>Property check questions</h2>
          <div className="mt-8 space-y-8">
            {PROPERTY_CHECK_FAQS.map((faq) => (
              <div key={faq.q}>
                <h3 className="font-[DM_Sans] text-base font-semibold text-[#1A1A1A] dark:text-[#F1F5F9]">{faq.q}</h3>
                <p className={`mt-2 ${MUTED_CLS}`}>{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${BAND_CLS} bg-[#F0F5F0] dark:bg-[#0D1526]`}>
        <div className="mx-auto max-w-[760px] px-6 py-16">
          <h2 className="font-[Fraunces] text-2xl font-semibold tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9]">
            Before you buy or sell
          </h2>
          <ul className="mt-5 space-y-3">
            {GUIDES.map((g) => (
              <li key={g.to}>
                <Link to={g.to} className="font-[DM_Sans] text-base font-medium text-[#0D9488] underline dark:text-[#14B8A6]">
                  {g.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </MarketingShell>
  );
};

export default PropertyCheckPage;
