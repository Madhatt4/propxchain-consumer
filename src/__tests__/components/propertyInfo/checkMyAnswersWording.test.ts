// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The panel's wording rules. A rung read off the wrong end of the rubric
 * would tell a seller their TA10 is "fully covered" when it is barely
 * started, so the TA10 reversal is tested from both ends.
 */
import { describe, it, expect } from 'vitest';

import {
  bySeverity,
  followUpHeading,
  followUpWords,
  formatCheckedAt,
  severityStyle,
  toPercent,
} from '../../../components/propertyInfo/checkMyAnswersWording';

describe('followUpWords', () => {
  it('should read the TA6 score straight off the conveyancer_risk rubric', () => {
    expect(followUpWords('ta6', 0)).toBe('none');
    expect(followUpWords('ta6', 3)).toBe('serious issues likely to delay exchange');
  });

  it('should read the TA10 score off the completeness rubric back to front', () => {
    expect(followUpWords('ta10', 0)).toBe('fully covered');
    expect(followUpWords('ta10', 3)).toBe('barely started');
  });

  it('should round a fractional score to the nearest rung', () => {
    expect(followUpWords('ta6', 1.4)).toBe('a couple of routine enquiries');
    expect(followUpWords('ta6', 1.6)).toBe('several substantive enquiries');
  });

  it('should clamp a score outside the rubric instead of returning undefined', () => {
    expect(followUpWords('ta6', -5)).toBe('none');
    expect(followUpWords('ta6', 99)).toBe('serious issues likely to delay exchange');
  });
});

describe('followUpHeading', () => {
  it('should name what the score measures, which differs between the two forms', () => {
    expect(followUpHeading('ta6')).toContain('Follow-up');
    expect(followUpHeading('ta10')).toContain('complete');
  });
});

describe('toPercent', () => {
  it('should render a probability as a whole percent', () => {
    expect(toPercent(0.08)).toBe(8);
    expect(toPercent(0.865)).toBe(87);
  });

  it('should clamp out-of-range and non-finite values to a percentage that can be shown', () => {
    expect(toPercent(-1)).toBe(0);
    expect(toPercent(4)).toBe(100);
    expect(toPercent(Number.NaN)).toBe(0);
  });
});

describe('bySeverity', () => {
  it('should sort block before warn before info, then by probability within a severity', () => {
    const flags = [
      { key: 'c', severity: 'info' as const, probability: 0.95 },
      { key: 'a', severity: 'warn' as const, probability: 0.61 },
      { key: 'b', severity: 'warn' as const, probability: 0.72 },
      { key: 'd', severity: 'block' as const, probability: 0.81 },
    ];

    expect([...flags].sort(bySeverity).map((f) => f.key)).toEqual(['d', 'b', 'a', 'c']);
  });
});

describe('severityStyle', () => {
  it('should give block red, warn amber and info grey', () => {
    expect(severityStyle('block').chip).toContain('red');
    expect(severityStyle('warn').chip).toContain('amber');
    expect(severityStyle('info').chip).toContain('gray');
  });

  it('should carry wording for screen readers, because colour alone cannot say it', () => {
    expect(severityStyle('block').announce).not.toBe('');
    expect(severityStyle('info').announce).not.toBe(severityStyle('block').announce);
  });
});

describe('formatCheckedAt', () => {
  it('should return the raw string when the timestamp will not parse', () => {
    expect(formatCheckedAt('not a date')).toBe('not a date');
  });

  it('should render a real ISO timestamp as something readable', () => {
    expect(formatCheckedAt('2026-09-19T10:00:00.000Z')).toMatch(/2026/);
  });
});
