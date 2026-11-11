// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import {
  depositSentText,
  formatIsoDate,
  formatPence,
  fromCandidDepositSent,
  fromCandidRegistrationStatus,
  registrationText,
  type RegistrationStatus,
} from '../conveyancerRecords';

const COMPLETED_NS = BigInt(Date.UTC(2026, 10, 11, 12)) * 1_000_000n;

function registration(overrides: Partial<RegistrationStatus> = {}): RegistrationStatus {
  return { completedAt: null, awaitingApplication: false, submittedOn: null, applicationReference: null, ...overrides };
}

describe('fromCandidDepositSent', () => {
  it('should unwrap the record with an amount in pence', () => {
    expect(fromCandidDepositSent([{ depositSent: [{ sentOn: '2026-11-12', recordedAt: 1n, amountPence: [2_500_000n] }] }]))
      .toEqual({ sentOn: '2026-11-12', amountPence: 2_500_000 });
  });

  it('should give a null amount when none was recorded', () => {
    expect(fromCandidDepositSent([{ depositSent: [{ sentOn: '2026-11-12', recordedAt: 1n, amountPence: [] }] }]))
      .toEqual({ sentOn: '2026-11-12', amountPence: null });
  });

  it('should be null when nothing is recorded or the caller is not a member', () => {
    expect(fromCandidDepositSent([{ depositSent: [] }])).toBeNull();
    expect(fromCandidDepositSent([])).toBeNull();
  });
});

describe('fromCandidRegistrationStatus', () => {
  it('should unwrap the status and convert completion to milliseconds', () => {
    const result = fromCandidRegistrationStatus([{
      completedAt: [COMPLETED_NS],
      submittedOn: ['2026-11-13'],
      nextReminderAt: [],
      applicationReference: ['TEST/123'],
      awaitingApplication: false,
      remindersDue: 0n,
    }]);
    expect(result).toEqual({
      completedAt: Date.UTC(2026, 10, 11, 12),
      awaitingApplication: false,
      submittedOn: '2026-11-13',
      applicationReference: 'TEST/123',
    });
  });

  it('should be null for a deal the caller cannot read', () => {
    expect(fromCandidRegistrationStatus([])).toBeNull();
  });
});

describe('depositSentText', () => {
  it('should name the date and the amount in pounds', () => {
    expect(depositSentText({ sentOn: '2026-11-12', amountPence: 2_500_050 }))
      .toBe("Deposit of £25,000.50 sent by the buyer's conveyancer on 12 November 2026");
  });

  it('should leave the amount out when none was recorded', () => {
    expect(depositSentText({ sentOn: '2026-11-12', amountPence: null }))
      .toBe("Deposit sent by the buyer's conveyancer on 12 November 2026");
  });

  it('should say not recorded yet when there is no record', () => {
    expect(depositSentText(null)).toBe('Not recorded yet');
  });

  it('should never imply PropXchain holds the money', () => {
    const text = depositSentText({ sentOn: '2026-11-12', amountPence: 100 });
    expect(text).not.toMatch(/PropXchain|held|escrow|quote/i);
  });
});

describe('registrationText', () => {
  it('should give the date and HMLR reference once recorded', () => {
    expect(registrationText(registration({ completedAt: 1, submittedOn: '2026-11-13', applicationReference: 'TEST/123' })))
      .toBe('Registration application submitted to HM Land Registry on 13 November 2026, ref TEST/123');
  });

  it("should say it is waiting for the buyer's conveyancer after completion", () => {
    const waiting = "Waiting for the buyer's conveyancer to submit the registration application";
    expect(registrationText(registration({ awaitingApplication: true, completedAt: 1 }))).toBe(waiting);
    expect(registrationText(registration({ completedAt: 1 }))).toBe(waiting);
  });

  it('should say nothing before completion or when unreadable', () => {
    expect(registrationText(registration())).toBeNull();
    expect(registrationText(null)).toBeNull();
  });
});

describe('formatting', () => {
  it('should show an unparseable date as given', () => {
    expect(formatIsoDate('soon')).toBe('soon');
  });

  it('should format pence as pounds with two decimals', () => {
    expect(formatPence(0)).toBe('£0.00');
    expect(formatPence(123_456)).toBe('£1,234.56');
  });
});
