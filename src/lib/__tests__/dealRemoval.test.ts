// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, expect, it } from 'vitest';
import { isDealParty, isSellerParty, removeActionFor, type RemovableDeal } from '../dealRemoval';

const party = (principal: string): { principal: string } => ({ principal });

// An agent-led sale after the handover: the agent created it, the seller now
// holds the seller slot, a co-seller is on the list and a buyer has joined.
const deal: RemovableDeal = {
  seller: 'SELLER',
  buyer: 'BUYER',
  createdBy: 'AGENT',
  sellers: [party('SELLER'), party('CO_SELLER')],
  buyers: [party('BUYER')],
};

describe('removeActionFor', () => {
  it('should offer Delete to the primary seller', () => {
    expect(removeActionFor(deal, 'SELLER')).toBe('delete');
  });

  it('should offer Delete to a co-seller who is only on the sellers list', () => {
    expect(removeActionFor(deal, 'CO_SELLER')).toBe('delete');
  });

  it('should offer Leave to the buyer', () => {
    expect(removeActionFor(deal, 'BUYER')).toBe('leave');
  });

  it('should offer neither to a creator who holds no party slot', () => {
    expect(removeActionFor(deal, 'AGENT')).toBe('none');
  });

  it('should never offer Delete to a seller delegate', () => {
    const withDelegate: RemovableDeal = { ...deal, delegates: [['SELLER', 'DELEGATE']] };
    expect(removeActionFor(withDelegate, 'DELEGATE')).toBe('leave');
  });

  it('should offer neither to a seller delegate who also created the deal', () => {
    const delegateCreated: RemovableDeal = { ...deal, createdBy: 'DELEGATE', delegates: [['SELLER', 'DELEGATE']] };
    expect(removeActionFor(delegateCreated, 'DELEGATE')).toBe('none');
  });

  it('should offer Leave to a buyer who created the deal', () => {
    expect(removeActionFor({ ...deal, createdBy: 'BUYER' }, 'BUYER')).toBe('leave');
  });

  it('should offer Delete to the seller before a buyer joins (buyer slot holds the seller)', () => {
    const noBuyer: RemovableDeal = { seller: 'SELLER', buyer: 'SELLER', createdBy: 'SELLER' };
    expect(removeActionFor(noBuyer, 'SELLER')).toBe('delete');
  });

  it('should offer neither when there is no signed-in principal', () => {
    expect(removeActionFor(deal, null)).toBe('none');
    expect(removeActionFor(deal, '')).toBe('none');
  });

  it('should treat a deal with no party lists as slot-only', () => {
    const slotsOnly: RemovableDeal = { seller: 'SELLER', buyer: 'BUYER', createdBy: 'SELLER' };
    expect(removeActionFor(slotsOnly, 'SELLER')).toBe('delete');
    expect(removeActionFor(slotsOnly, 'CO_SELLER')).toBe('leave');
  });
});

describe('isSellerParty', () => {
  it('should count the seller slot and the sellers list', () => {
    expect(isSellerParty(deal, 'SELLER')).toBe(true);
    expect(isSellerParty(deal, 'CO_SELLER')).toBe(true);
  });

  it('should not count the buyer, the creator agent or a delegate', () => {
    const withDelegate: RemovableDeal = { ...deal, delegates: [['SELLER', 'DELEGATE']] };
    expect(isSellerParty(withDelegate, 'BUYER')).toBe(false);
    expect(isSellerParty(withDelegate, 'AGENT')).toBe(false);
    expect(isSellerParty(withDelegate, 'DELEGATE')).toBe(false);
    expect(isSellerParty(withDelegate, undefined)).toBe(false);
  });
});

describe('isDealParty', () => {
  it('should count the buyer, the seller and a co-seller as parties', () => {
    expect(isDealParty(deal, 'BUYER')).toBe(true);
    expect(isDealParty(deal, 'SELLER')).toBe(true);
    expect(isDealParty(deal, 'CO_SELLER')).toBe(true);
  });

  it('should not count a creator with no slot, or no principal', () => {
    expect(isDealParty(deal, 'AGENT')).toBe(false);
    expect(isDealParty(deal, 'CONVEYANCER')).toBe(false);
    expect(isDealParty(deal, undefined)).toBe(false);
  });
});
