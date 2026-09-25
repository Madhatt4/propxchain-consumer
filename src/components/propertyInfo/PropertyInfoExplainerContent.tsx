// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Explains the TA6 / TA10 / TA7 forms to a seller who has never seen them.
 *
 * Deliberately static copy rather than the generated narration the searches
 * explainer uses. That card is grounded in a per-property engine with
 * hundreds of distinct area profiles, so generation earns its cost. Here the
 * only variable is tenure — two possible outputs — and hand-written copy is
 * both cheaper and better.
 */

import React from 'react';
import { Link } from 'react-router-dom';

import type { Tenure } from '../../types/listing.types';

const GUIDE_PATH = '/resources/selling/property-information-forms-explained';
const BASPI_PATH = '/resources/industry-and-reform/baspi-explained';

/**
 * Whether to mention TA7. Mirrors visibleForms() in PropertyInfoStage — an
 * unknown tenure surfaces the leasehold form rather than hiding it, because
 * describing a form the seller does not need is a smaller harm than staying
 * silent about one they do.
 */
export function showsLeaseholdForm(tenure: Tenure | null | undefined): boolean {
  return tenure !== 'freehold' && tenure !== 'shareOfFreehold';
}

const FormBlock: React.FC<{ name: string; summary: string; detail: string }> = ({
  name,
  summary,
  detail,
}) => (
  <li className="border-l-2 border-[#84A98C]/50 py-1 pl-3">
    <p className="font-dm-sans text-sm font-medium text-gray-900 dark:text-gray-100">
      {name} — {summary}
    </p>
    <p className="font-dm-sans text-xs text-gray-600 dark:text-gray-400">{detail}</p>
  </li>
);

export interface PropertyInfoExplainerContentProps {
  tenure: Tenure | null | undefined;
}

export default function PropertyInfoExplainerContent({
  tenure,
}: PropertyInfoExplainerContentProps): React.ReactElement {
  return (
    <div className="space-y-4">
      <p className="font-dm-sans text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        These are the standard forms every sale in England and Wales uses. The buyer&apos;s
        solicitor turns your answers into the enquiries that hold up exchange, so answering them
        properly now is what prevents weeks of back-and-forth later.
      </p>

      <section>
        <h4 className="font-geist-mono text-[0.65rem] uppercase tracking-[0.14em] text-[#5F8A68]">
          What each form covers
        </h4>
        <ul className="mt-2 space-y-2">
          <FormBlock
            name="TA6"
            summary="Property Information"
            detail="Boundaries, disputes with neighbours, notices, alterations you have made, guarantees, and how the property is connected for services."
          />
          <FormBlock
            name="TA10"
            summary="Fittings & Contents"
            detail="Exactly what stays and what goes, room by room. Disagreements about curtains, light fittings and garden pots are the most common completion-day argument, and this form is what prevents them."
          />
          {showsLeaseholdForm(tenure) && (
            <FormBlock
              name="TA7"
              summary="Leasehold Information"
              detail="Service charges, ground rent, the managing agent, and the lease terms. Leasehold sales stall here more than anywhere else, because the answers usually have to come from the freeholder or managing agent rather than from you."
            />
          )}
        </ul>
      </section>

      <section className="rounded-lg border border-amber-300/60 bg-amber-50/60 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
        <h4 className="font-geist-mono text-[0.65rem] uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">
          Worth taking slowly
        </h4>
        <p className="mt-1 font-dm-sans text-xs leading-relaxed text-gray-700 dark:text-gray-300">
          Your answers here are <strong>legally binding representations</strong>. A buyer who
          relies on an answer that turns out to be wrong can bring a claim against you after
          completion — a boundary dispute you forgot to mention, or work done without building
          regulations sign-off. Where the honest answer is &ldquo;I don&apos;t know&rdquo;, saying
          so is safer than guessing.
        </p>
      </section>

      <section>
        <h4 className="font-geist-mono text-[0.65rem] uppercase tracking-[0.14em] text-gray-400">
          Useful to have to hand
        </h4>
        <p className="mt-1 font-dm-sans text-xs text-gray-500 dark:text-gray-400">
          FENSA or CERTASS certificates for replacement windows · building regulations sign-off for
          any structural work · planning permissions · guarantees for damp, timber or roofing work ·
          boiler and electrical certificates
          {showsLeaseholdForm(tenure) ? ' · your lease and recent service charge statements' : ''}
        </p>
      </section>

      <div className="space-y-1">
        <Link
          to={GUIDE_PATH}
          className="block font-dm-sans text-xs font-medium text-[#5F8A68] underline"
        >
          Read what these forms ask, and the answers people most often get wrong
        </Link>
        <Link
          to={BASPI_PATH}
          className="block font-dm-sans text-xs font-medium text-[#5F8A68] underline"
        >
          How these relate to BASPI and upfront information
        </Link>
      </div>
    </div>
  );
}
