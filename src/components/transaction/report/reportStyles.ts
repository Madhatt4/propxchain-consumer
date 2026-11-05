// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Type and colour for the document-style property report, from the brand
 * system: Fraunces headings, DM Sans text, Geist Mono for figures, teal and
 * sage on white. Amber and red carry meaning (moderate and serious hazards)
 * and are never decoration.
 */

export const R = {
  ink: 'text-[#1A1A1A] dark:text-[#E5E7EB]',
  ink2: 'text-[#4B5563] dark:text-[#CBD5E1]',
  muted: 'text-[#6B7280] dark:text-[#94A3B8]',
  rule: 'border-[#DAE5DC] dark:border-[#1F2937]',
  paper: 'bg-white dark:bg-[#111827]',
  h2: 'font-[Fraunces] text-[1.6rem] 2xl:text-[1.9rem] font-bold leading-tight tracking-[-0.02em] text-[#1A1A1A] dark:text-[#F1F5F9]',
  h3: 'font-[Fraunces] text-lg 2xl:text-xl font-bold tracking-[-0.01em] text-[#1A1A1A] dark:text-[#F1F5F9]',
  body: 'font-[DM_Sans] text-[15px] 2xl:text-base leading-relaxed text-[#4B5563] dark:text-[#CBD5E1]',
  finding: 'font-[DM_Sans] text-[17px] 2xl:text-[19px] leading-relaxed text-[#1A1A1A] dark:text-[#E5E7EB]',
  source: 'font-[DM_Sans] text-[13px] 2xl:text-sm text-[#6B7280] dark:text-[#94A3B8]',
  mono: 'font-["Geist_Mono",ui-monospace,monospace] tabular-nums',
  th: 'py-2 pr-3 text-left font-[DM_Sans] text-[13px] 2xl:text-sm font-medium text-[#6B7280] dark:text-[#94A3B8]',
  td: 'py-2.5 pr-3 align-top font-[DM_Sans] text-[15px] 2xl:text-base text-[#1A1A1A] dark:text-[#E5E7EB]',
} as const;

/** Text colour for a finding by severity. Constraints are amber, hazards amber or red. */
export const TONE_TEXT = {
  high: 'text-[#B91C1C] dark:text-[#F87171]',
  medium: 'text-[#B45309] dark:text-[#FBBF24]',
  constraint: 'text-[#B45309] dark:text-[#FBBF24]',
  clear: 'text-[#047857] dark:text-[#34D399]',
  unknown: 'text-[#6B7280] dark:text-[#94A3B8]',
} as const;

export type Tone = keyof typeof TONE_TEXT;

export const TONE_FILL: Record<Tone, string> = {
  high: 'bg-[#B91C1C]',
  medium: 'bg-[#B45309]',
  constraint: 'bg-[#B45309]',
  clear: 'bg-[#047857]',
  unknown: 'bg-[#9CA3AF]',
};
