import { describe, it, expect } from 'vitest';

import { getViewerRole } from '../viewerRole';
import type { Transaction } from '../../types/transaction.types';

/**
 * Reported from production on 2026-09-04: a conveyancer who joined a client's
 * transaction with a code, then opened the consumer dashboard, was shown the
 * buyer's document checklist — Proof of Funds, Mortgage Agreement — because
 * the only role check was `isSeller`, and everyone who failed it was assumed
 * to be the buyer.
 */

const SELLER = 'principal-seller';
const BUYER = 'principal-buyer';
const CONVEYANCER = 'principal-conveyancer';

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    seller: SELLER,
    buyer: BUYER,
    createdBy: SELLER,
    accessList: [SELLER, BUYER, CONVEYANCER],
    ...overrides,
  } as Transaction;
}

describe('getViewerRole', () => {
  it('should identify the seller by the seller field', () => {
    expect(getViewerRole(tx(), SELLER)).toBe('seller');
  });

  it('should identify the buyer', () => {
    expect(getViewerRole(tx(), BUYER)).toBe('buyer');
  });

  it('should not call an access-list party the buyer', () => {
    // The actual defect: a conveyancer is on the transaction but owes none of
    // the buyer's documents.
    expect(getViewerRole(tx(), CONVEYANCER)).toBe('other');
  });

  it('should treat the creator as the seller even when the seller field is empty', () => {
    // Older records do not always populate tx.seller.
    const record = tx({ seller: undefined, createdBy: SELLER });

    expect(getViewerRole(record, SELLER)).toBe('seller');
  });

  it('should prefer seller when the same principal is both seller and buyer', () => {
    // Shouldn't happen in production, but the order must be deterministic
    // rather than depending on field evaluation order.
    const record = tx({ seller: SELLER, buyer: SELLER, createdBy: SELLER });

    expect(getViewerRole(record, SELLER)).toBe('seller');
  });

  it('should report other for someone with no relationship to the transaction', () => {
    expect(getViewerRole(tx(), 'principal-stranger')).toBe('other');
  });

  it('should report other rather than throwing when there is no transaction', () => {
    expect(getViewerRole(null, SELLER)).toBe('other');
    expect(getViewerRole(undefined, SELLER)).toBe('other');
  });

  it('should report other rather than matching an empty principal', () => {
    // A logged-out or not-yet-resolved principal must never match a
    // transaction whose fields are themselves empty.
    const record = tx({ seller: '', buyer: '', createdBy: '' });

    expect(getViewerRole(record, '')).toBe('other');
    expect(getViewerRole(record, null)).toBe('other');
  });
});
