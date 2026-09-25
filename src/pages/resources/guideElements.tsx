// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Guides section — typographic primitives. Keeps the three article
 * files compact and the editorial treatment identical across guides.
 * DESIGN.md compliant: Fraunces display, DM Sans body, Geist Mono
 * labels, teal links, sage-tinted callouts with full borders.
 */

import React, { type ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** Section heading inside an article body. */
/**
 * `id` is optional and exists so other surfaces can deep-link to a specific
 * section — the searches explainer card links straight to the search it is
 * describing rather than dropping the reader at the top of a long guide.
 */
export const GuideH2: React.FC<{ children: ReactNode; id?: string }> = ({ children, id }) => (
  <h2
    id={id}
    className="mt-14 scroll-mt-24 font-[Fraunces] text-[1.65rem] font-semibold leading-snug tracking-tight text-[#1A1A1A] dark:text-[#F1F5F9]"
  >
    {children}
  </h2>
);

/** Sub-heading inside an article body. */
export const GuideH3: React.FC<{ children: ReactNode }> = ({ children }) => (
  <h3 className="mt-8 font-[Fraunces] text-[1.2rem] font-semibold leading-snug text-[#1A1A1A] dark:text-[#F1F5F9]">
    {children}
  </h3>
);

/** Body paragraph. 70ch measure is set by the article container. */
export const GuideP: React.FC<{ children: ReactNode }> = ({ children }) => (
  <p className="mt-5 font-[DM_Sans] text-[1.0325rem] leading-[1.8] text-[#374151] dark:text-[#CBD5E1]">
    {children}
  </p>
);

/** Unordered list with teal markers, matching paragraph rhythm. */
export const GuideList: React.FC<{ items: ReactNode[] }> = ({ items }) => (
  <ul className="mt-5 space-y-2.5">
    {items.map((item, i) => (
      <li
        key={i}
        className="flex gap-3 font-[DM_Sans] text-[1.0325rem] leading-[1.7] text-[#374151] dark:text-[#CBD5E1]"
      >
        <span aria-hidden="true" className="mt-[0.65em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#0D9488] dark:bg-[#14B8A6]" />
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

/** Inline emphasis for defined terms on first use. */
export const Term: React.FC<{ children: ReactNode }> = ({ children }) => (
  <strong className="font-semibold text-[#1A1A1A] dark:text-[#F1F5F9]">{children}</strong>
);

/** Internal link, teal and always underlined for accessibility. */
export const GuideLink: React.FC<{ to: string; children: ReactNode }> = ({ to, children }) => (
  <Link
    to={to}
    className="font-medium text-[#0D9488] underline decoration-[#0D9488]/40 underline-offset-2 transition-colors hover:decoration-[#0D9488] dark:text-[#14B8A6] dark:decoration-[#14B8A6]/40 dark:hover:decoration-[#14B8A6]"
  >
    {children}
  </Link>
);

/**
 * Key-fact callout — full border + sage-tinted surface (DESIGN.md
 * surface-alt), small mono label. Never a side-stripe.
 */
export const Callout: React.FC<{ label?: string; children: ReactNode }> = ({
  label = 'At a glance',
  children,
}) => (
  <aside className="mt-8 rounded-xl border border-[#DAE5DC] bg-[#F0F5F0] p-6 dark:border-[#1E293B] dark:bg-[#141F33]">
    <p className="font-[Geist_Mono] text-[0.65rem] uppercase tracking-[0.14em] text-[#5F8A68] dark:text-[#6EE7B7]">
      {label}
    </p>
    <div className="mt-2.5 font-[DM_Sans] text-[0.97rem] leading-[1.75] text-[#1A1A1A] dark:text-[#E2E8F0]">
      {children}
    </div>
  </aside>
);
