// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Presentation rules for the "Check my answers" panel, kept out of the
 * component so they can be tested as plain functions.
 *
 * The rubric words are the ones the check itself was scored against, not a
 * paraphrase: showing a seller "2.1 out of 3" means nothing, and inventing
 * friendlier wording would report a rung the model was never asked about.
 */
import { FORM_CHECK_FOLLOW_UP_MAX } from '@/services/formCheck.service';
import type { FormCheckForm, FormCheckSeverity } from '@/services/formCheck.service';

/** TA6's `conveyancer_risk` rubric, indexed by the score itself (0 = none). */
const TA6_FOLLOW_UP_RUBRIC: readonly string[] = [
  'none',
  'a couple of routine enquiries',
  'several substantive enquiries',
  'serious issues likely to delay exchange',
];

/**
 * TA10 has no follow-up question of its own: its score is
 * FOLLOW_UP_MAX - completeness, so this is the `completeness` rubric read
 * back to front (score 0 = fully covered).
 */
const TA10_COVERAGE_RUBRIC: readonly string[] = [
  'fully covered',
  'most items covered',
  'major rooms only',
  'barely started',
];

/** What the score is measuring, which differs by form. */
export function followUpHeading(form: FormCheckForm): string {
  return form === 'ta6' ? "Follow-up your buyer's conveyancer may raise" : 'How complete this list looks';
}

/** The score as the rubric rung nearest to it. Out-of-range scores clamp. */
export function followUpWords(form: FormCheckForm, score: number): string {
  const rubric = form === 'ta6' ? TA6_FOLLOW_UP_RUBRIC : TA10_COVERAGE_RUBRIC;
  const rung = Math.min(FORM_CHECK_FOLLOW_UP_MAX, Math.max(0, Math.round(score)));
  return rubric[rung] ?? rubric[0];
}

/** A 0..1 probability as a whole percent, clamped. */
export function toPercent(probability: number): number {
  if (!Number.isFinite(probability)) return 0;
  return Math.round(Math.min(1, Math.max(0, probability)) * 100);
}

export interface SeverityStyle {
  /** Tailwind classes for the percent chip. */
  chip: string;
  /** Tailwind classes for the row's left border and background. */
  row: string;
  /** Screen-reader wording, since colour alone must never carry the meaning. */
  announce: string;
}

const SEVERITY_STYLES: Record<FormCheckSeverity, SeverityStyle> = {
  block: {
    chip: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    row: 'border-l-2 border-red-400 bg-red-50/60 dark:border-red-700 dark:bg-red-900/10',
    announce: 'Fix before submitting',
  },
  warn: {
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    row: 'border-l-2 border-amber-400 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-900/10',
    announce: 'Worth a look',
  },
  info: {
    chip: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
    row: 'border-l-2 border-gray-300 bg-gray-50/60 dark:border-slate-600 dark:bg-slate-800/40',
    announce: 'For information',
  },
};

export function severityStyle(severity: FormCheckSeverity): SeverityStyle {
  return SEVERITY_STYLES[severity];
}

const SEVERITY_RANK: Record<FormCheckSeverity, number> = { block: 0, warn: 1, info: 2 };

/**
 * Severity first, then the stronger probability within a severity. The
 * function already sorts by probability, but severity is what the seller acts
 * on, so it has to lead.
 */
export function bySeverity(
  a: { severity: FormCheckSeverity; probability: number },
  b: { severity: FormCheckSeverity; probability: number },
): number {
  const rank = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  return rank !== 0 ? rank : b.probability - a.probability;
}

/** `checkedAt` as a short local time, or the raw string if it will not parse. */
export function formatCheckedAt(checkedAt: string): string {
  const at = new Date(checkedAt);
  if (Number.isNaN(at.getTime())) return checkedAt;
  return at.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}
