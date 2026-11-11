// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { completionDateText, exchangeText, nanosToDate, toExchangeStatus } from '../exchangeStatus';

describe('nanosToDate', () => {
  it('should convert canister nanoseconds to a Date', () => {
    const ms = Date.UTC(2026, 0, 2);
    expect(nanosToDate(ms * 1_000_000)?.getTime()).toBe(ms);
    expect(nanosToDate(BigInt(ms) * 1_000_000n)?.getTime()).toBe(ms);
  });

  it('should return null for absent, zero or non-numeric values', () => {
    expect(nanosToDate(null)).toBeNull();
    expect(nanosToDate(undefined)).toBeNull();
    expect(nanosToDate(0)).toBeNull();
    expect(nanosToDate('123')).toBeNull();
  });
});

describe('toExchangeStatus', () => {
  it('should treat an unknown or missing status as not exchanged', () => {
    const s = toExchangeStatus({ status: undefined });
    expect(s.status).toBe('active');
    expect(s.isExchanged).toBe(false);
    expect(exchangeText(s)).toBe('Not exchanged yet');
  });

  it('should count completion stages as exchanged, and accept a Candid variant', () => {
    expect(toExchangeStatus({ status: { blockchain_completed: null } }).isExchanged).toBe(true);
    expect(toExchangeStatus({ status: 'completion_initiated' }).isExchanged).toBe(true);
  });

  it('should fall back to contractExchangeTimestamp when exchangedAt is missing', () => {
    const ms = Date.UTC(2026, 5, 1);
    const s = toExchangeStatus({ status: 'exchanged', contractExchangeTimestamp: ms * 1_000_000 });
    expect(s.exchangedAt?.getTime()).toBe(ms);
  });

  it('should say Exchanged without a date when the timestamp is missing', () => {
    expect(exchangeText(toExchangeStatus({ status: 'exchanged' }))).toBe('Exchanged');
  });

  it('should treat blank signatures as not confirmed', () => {
    const s = toExchangeStatus({ buyerSolicitorSignature: '  ', sellerSolicitorSignature: 'x' });
    expect(s.buyerConveyancerConfirmed).toBe(false);
    expect(s.sellerConveyancerConfirmed).toBe(true);
  });
});

describe('completionDateText', () => {
  it('should show the stored text when it is not a date', () => {
    expect(completionDateText(toExchangeStatus({ completionDate: 'TBC' }))).toBe('TBC');
  });

  it('should say not recorded when there is no completion date', () => {
    expect(completionDateText(toExchangeStatus({ completionDate: '' }))).toBe('Not recorded yet');
  });
});
