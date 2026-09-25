// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect } from 'vitest';
import { asPercent, isUntriaged, readTriage, urgencyLabel } from '../triage';

/** What the ticket function stores: decoded answers, never the ticket text. */
const STORED = {
  category: { kind: 'choice', choice: 'payments', probabilities: { payments: 0.88, account: 0.07 } },
  urgency: { kind: 'score', score: 3 },
  blocks_transaction: { kind: 'noul', probability: 0.82 },
  is_bug: { kind: 'noul', probability: 0.14 },
  answerable_from_help: { kind: 'noul', probability: 0.1 },
};

describe('readTriage', () => {
  it('should read every answer the ticket function stores', () => {
    const read = readTriage(STORED);

    expect(read.category).toEqual({ value: 'payments', probability: 0.88 });
    expect(read.urgency).toBe(3);
    expect(read.blocksTransaction).toBe(0.82);
    expect(read.isBug).toBe(0.14);
    expect(read.answerableFromHelp).toBe(0.1);
    expect(read.error).toBeNull();
  });

  it('should also read the undecoded wire shape, so a writer change cannot blank the panel', () => {
    const read = readTriage({
      category: { choice: 'forms', probabilities: { forms: 0.6 } },
      urgency: { score: 1 },
      blocks_transaction: { noul: 0.2 },
    });

    expect(read.category).toEqual({ value: 'forms', probability: 0.6 });
    expect(read.urgency).toBe(1);
    expect(read.blocksTransaction).toBe(0.2);
  });

  it('should surface the error a failed triage stores instead of answers', () => {
    const read = readTriage({ error: 'jev down' });

    expect(read.error).toBe('jev down');
    expect(read.category).toBeNull();
    expect(read.urgency).toBeNull();
  });

  it('should read a ticket with no triage column as untriaged rather than throwing', () => {
    expect(isUntriaged(readTriage(null))).toBe(true);
    expect(isUntriaged(readTriage(undefined))).toBe(true);
    expect(isUntriaged(readTriage({}))).toBe(true);
  });

  it('should ignore an answer whose shape it does not recognise', () => {
    const read = readTriage({ category: 'payments', urgency: [3], blocks_transaction: null });

    expect(read.category).toBeNull();
    expect(read.urgency).toBeNull();
    expect(read.blocksTransaction).toBeNull();
  });

  it('should leave the category probability null when no distribution came back', () => {
    expect(readTriage({ category: { kind: 'choice', choice: 'bug' } }).category).toEqual({
      value: 'bug',
      probability: null,
    });
  });

  it('should not call a ticket untriaged when only one answer survived', () => {
    expect(isUntriaged(readTriage({ urgency: { kind: 'score', score: 0 } }))).toBe(false);
  });
});

describe('triage display helpers', () => {
  it('should render a probability as whole percent and a missing one as a dash', () => {
    expect(asPercent(0.824)).toBe('82%');
    expect(asPercent(0)).toBe('0%');
    expect(asPercent(1)).toBe('100%');
    expect(asPercent(null)).toBe('—');
    expect(asPercent(Number.NaN)).toBe('—');
  });

  it('should put the urgency rubric into words and refuse a score off the scale', () => {
    expect(urgencyLabel(0)).toBe('Can wait');
    expect(urgencyLabel(2)).toBe('User is stuck');
    expect(urgencyLabel(3)).toBe('Money or a deadline at risk');
    expect(urgencyLabel(9)).toBe('Not scored');
    expect(urgencyLabel(null)).toBe('Not scored');
  });
});
