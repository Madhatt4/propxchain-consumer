// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Persistent presentation of a stage explainer, collapsed by default so it
 * sits quietly above the stage's own content.
 *
 * A sibling of CollapsibleProviderCard rather than a reuse: that component's
 * props are provider-shaped (logo, tagline, turnaround, fromPricePence) and
 * an explainer is not a provider. Four fabricated prop values would be worse
 * than the small duplication of its border treatment.
 */

import React, { useState, type ReactNode } from 'react';

export interface ExplainerCardProps {
  /** Small uppercase kicker, e.g. "What these searches are & why". */
  label: string;
  /** One-line summary shown while collapsed. */
  headline: string;
  children: ReactNode;
}

export default function ExplainerCard({
  label,
  headline,
  children,
}: ExplainerCardProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-[#0D9488]/40 bg-white shadow-sm dark:bg-[#0F1729]">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <span>
          <span className="block font-geist-mono text-[0.65rem] uppercase tracking-[0.14em] text-[#5F8A68]">
            {label}
          </span>
          <span className="mt-1 block font-dm-sans text-sm text-gray-700 dark:text-gray-300">
            {headline}
          </span>
        </span>
        <span aria-hidden="true" className="text-[#5F8A68]">
          {expanded ? '⌃' : '⌄'}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-gray-100 p-4 dark:border-[#1E2A3A]">{children}</div>
      )}
    </div>
  );
}
