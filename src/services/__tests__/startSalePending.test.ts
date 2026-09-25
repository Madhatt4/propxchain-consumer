// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { clearPendingStartSale, loadPendingStartSale, savePendingStartSale } from '../startSalePending';

describe('startSalePending', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('remembers what step 1 minted, per listing, and forgets it when the sale completes', () => {
    savePendingStartSale('listing-1', { transactionId: 'tx_1', inviteCode: 'TX-AAAA-1111' });
    savePendingStartSale('listing-2', { transactionId: 'tx_2', inviteCode: 'TX-BBBB-2222' });

    expect(loadPendingStartSale('listing-1')).toEqual({ transactionId: 'tx_1', inviteCode: 'TX-AAAA-1111' });
    expect(loadPendingStartSale('listing-2')).toEqual({ transactionId: 'tx_2', inviteCode: 'TX-BBBB-2222' });

    clearPendingStartSale('listing-1');
    expect(loadPendingStartSale('listing-1')).toBeNull();
    // One listing completing says nothing about another still in flight.
    expect(loadPendingStartSale('listing-2')).not.toBeNull();
  });

  it('returns null for a listing with nothing pending', () => {
    expect(loadPendingStartSale('listing-never-started')).toBeNull();
  });

  it('refuses a malformed or half-written entry rather than resuming onto nothing', () => {
    sessionStorage.setItem('propxchain.startSale.pending.listing-1', 'not json');
    expect(loadPendingStartSale('listing-1')).toBeNull();

    sessionStorage.setItem('propxchain.startSale.pending.listing-1', JSON.stringify({ transactionId: 'tx_1' }));
    expect(loadPendingStartSale('listing-1')).toBeNull();

    sessionStorage.setItem('propxchain.startSale.pending.listing-1', JSON.stringify({ transactionId: '', inviteCode: 'TX-AAAA-1111' }));
    expect(loadPendingStartSale('listing-1')).toBeNull();
  });

  it('never throws when storage is unavailable, since a sale must not fail over a note to self', () => {
    vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(sessionStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(sessionStorage, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(() => savePendingStartSale('listing-1', { transactionId: 'tx_1', inviteCode: 'c' })).not.toThrow();
    expect(loadPendingStartSale('listing-1')).toBeNull();
    expect(() => clearPendingStartSale('listing-1')).not.toThrow();
  });
});
