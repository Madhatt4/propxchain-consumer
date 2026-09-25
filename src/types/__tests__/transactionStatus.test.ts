// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

import { describe, expect, it } from 'vitest';
import {
  TRANSACTION_STATUSES,
  TRANSACTION_STATUS_LABEL,
  TRANSACTION_STATUS_PROGRESS,
  isAtLeastStatus,
  isCompletedStatus,
  isExchangedStatus,
  isTransactionStatus,
  toTransactionStatus,
} from '../transactionStatus';

describe('transactionStatus', () => {
  it('should list exactly the five Candid variants, in progression order', () => {
    expect([...TRANSACTION_STATUSES]).toEqual([
      'active',
      'exchanged',
      'completion_initiated',
      'blockchain_completed',
      'land_registry_registered',
    ]);
  });

  it('should have a label and a progress figure for every status', () => {
    for (const s of TRANSACTION_STATUSES) {
      expect(TRANSACTION_STATUS_LABEL[s]).toBeTruthy();
      expect(TRANSACTION_STATUS_PROGRESS[s]).toBeGreaterThan(0);
    }
  });

  it('should reject the eight phantom statuses the consumer used to carry', () => {
    for (const s of ['draft', 'document-collection', 'searches', 'contract-prep', 'exchange', 'completion', 'completed', 'cancelled']) {
      expect(isTransactionStatus(s)).toBe(false);
    }
  });

  it('should normalise a Candid variant, a string, and fall back to active', () => {
    expect(toTransactionStatus({ exchanged: null })).toBe('exchanged');
    expect(toTransactionStatus('land_registry_registered')).toBe('land_registry_registered');
    expect(toTransactionStatus({ nonsense: null })).toBe('active');
    expect(toTransactionStatus('draft')).toBe('active');
    expect(toTransactionStatus(undefined)).toBe('active');
  });

  it('should order statuses so "at least exchanged" holds from exchange to registration', () => {
    expect(isAtLeastStatus('active', 'exchanged')).toBe(false);
    expect(isAtLeastStatus('exchanged', 'exchanged')).toBe(true);
    expect(isAtLeastStatus('land_registry_registered', 'exchanged')).toBe(true);
    expect(isAtLeastStatus('draft', 'active')).toBe(false);
  });

  it('should split completed from exchanged without overlap', () => {
    expect(TRANSACTION_STATUSES.filter(isCompletedStatus)).toEqual(['blockchain_completed', 'land_registry_registered']);
    expect(TRANSACTION_STATUSES.filter(isExchangedStatus)).toEqual(['exchanged', 'completion_initiated']);
    expect(isCompletedStatus('completed')).toBe(false);
  });
});
