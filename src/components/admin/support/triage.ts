// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Reading `support_tickets.triage` for the desk. The column holds the answers
 * a decision model gave when the ticket was raised — a category with its
 * distribution, an urgency score, and three yes-probabilities. Never the
 * ticket text: the state it was asked about is not stored anywhere.
 *
 * Everything here is defensive. `triage` is a JSON column, it may be null on a
 * ticket raised before triage existed, and it holds `{ error }` instead of
 * answers whenever the model was unreachable. A shape we do not recognise
 * reads as "not triaged" rather than throwing inside a render.
 */

/** One answer, already narrowed to what the desk displays. */
export interface TriageRead {
  /** The chosen category and how sure the model was, when it said. */
  category: { value: string; probability: number | null } | null;
  /** 0-3 on the queue's own rubric, or null when untriaged. */
  urgency: number | null;
  blocksTransaction: number | null;
  isBug: number | null;
  answerableFromHelp: number | null;
  /** Set when triage failed; the ticket is still perfectly answerable. */
  error: string | null;
}

const EMPTY: TriageRead = {
  category: null,
  urgency: null,
  blocksTransaction: null,
  isBug: null,
  answerableFromHelp: null,
  error: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Both shapes are accepted on purpose. The stored answer is the decoded
 * `{ kind: 'noul', probability }`, but the model's own wire shape is
 * `{ noul: 0.82 }`, and the two are one `JSON.stringify` apart on the writing
 * side. Reading both costs a line and removes a whole class of silent blanks.
 */
function probability(answer: unknown): number | null {
  if (!isRecord(answer)) return null;
  if (typeof answer.probability === 'number') return answer.probability;
  if (typeof answer.noul === 'number') return answer.noul;
  return null;
}

function scoreOf(answer: unknown): number | null {
  if (!isRecord(answer)) return null;
  if (typeof answer.score === 'number') return answer.score;
  return null;
}

function categoryOf(answer: unknown): TriageRead['category'] {
  if (!isRecord(answer)) return null;
  const value = typeof answer.choice === 'string' ? answer.choice : null;
  if (!value) return null;
  const distribution = isRecord(answer.probabilities) ? answer.probabilities : null;
  const chosen = distribution?.[value];
  return { value, probability: typeof chosen === 'number' ? chosen : null };
}

/** Narrows the raw column to what the triage panel renders. Never throws. */
export function readTriage(triage: Record<string, unknown> | null | undefined): TriageRead {
  if (!isRecord(triage)) return EMPTY;
  if (typeof triage.error === 'string') return { ...EMPTY, error: triage.error };
  return {
    category: categoryOf(triage.category),
    urgency: scoreOf(triage.urgency),
    blocksTransaction: probability(triage.blocks_transaction),
    isBug: probability(triage.is_bug),
    answerableFromHelp: probability(triage.answerable_from_help),
    error: null,
  };
}

/** True when there is nothing worth drawing a panel for. */
export function isUntriaged(read: TriageRead): boolean {
  return (
    read.category === null &&
    read.urgency === null &&
    read.blocksTransaction === null &&
    read.isBug === null &&
    read.answerableFromHelp === null
  );
}

/** A probability as whole percent, for a line an admin reads at a glance. */
export function asPercent(probability: number | null): string {
  if (probability === null || !Number.isFinite(probability)) return '—';
  return `${Math.round(probability * 100)}%`;
}

const URGENCY_LABELS = ['Can wait', 'Normal', 'User is stuck', 'Money or a deadline at risk'] as const;

/** The queue's 0-3 rubric in words. Out-of-range scores read as unknown. */
export function urgencyLabel(urgency: number | null): string {
  if (urgency === null || !Number.isInteger(urgency)) return 'Not scored';
  return URGENCY_LABELS[urgency] ?? 'Not scored';
}
