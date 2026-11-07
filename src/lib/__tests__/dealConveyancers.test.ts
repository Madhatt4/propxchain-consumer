// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import {
  conveyancerLines,
  conveyancerMatterPath,
  conveyancerOfSlot,
  conveyancerSideOf,
  dealConveyancersOf,
  hasRealBuyer,
  NO_CONVEYANCERS,
} from '../dealConveyancers';

const BUYER_FIRM = { principal: 'buyer-firm', firmName: 'Test Firm One' };
const SELLER_FIRM = { principal: 'seller-firm', firmName: 'Test Firm Two' };
const BOTH = { buyer: BUYER_FIRM, seller: SELLER_FIRM };

function texts(...args: Parameters<typeof conveyancerLines>): string[] {
  return conveyancerLines(...args).map((l) => l.text);
}

/** A Candid-style Principal: a fresh object each time, equal only by text. */
function principal(text: string): { toText: () => string } {
  return { toText: () => text };
}

describe('conveyancerOfSlot', () => {
  it('should read a Candid opt holding a record with a Principal object', () => {
    const slot = [{ principal: { toText: () => 'seller-firm' }, firmName: ' Test Firm Two ', name: 'ignored' }];
    expect(conveyancerOfSlot(slot)).toEqual({ principal: 'seller-firm', firmName: 'Test Firm Two' });
  });

  it('should return null for an empty opt, null or a record with no principal', () => {
    expect(conveyancerOfSlot([])).toBeNull();
    expect(conveyancerOfSlot(null)).toBeNull();
    expect(conveyancerOfSlot({ firmName: 'X' })).toBeNull();
  });

  it('should keep the principal when the firm name is blank', () => {
    expect(conveyancerOfSlot({ principal: 'p', firmName: '  ' })).toEqual({ principal: 'p', firmName: null });
  });
});

describe('dealConveyancersOf', () => {
  it('should read both slots', () => {
    expect(dealConveyancersOf({ buyerSolicitor: [BUYER_FIRM], sellerSolicitor: [SELLER_FIRM] })).toEqual(BOTH);
  });

  it('should be empty before the deal loads', () => {
    expect(dealConveyancersOf(null)).toEqual(NO_CONVEYANCERS);
  });
});

describe('conveyancerSideOf', () => {
  it('should give each joined firm its own side', () => {
    expect(conveyancerSideOf(BOTH, 'buyer-firm')).toBe('buyer');
    expect(conveyancerSideOf(BOTH, 'seller-firm')).toBe('seller');
  });

  it('should be null for a client, nobody, or a firm on both slots', () => {
    expect(conveyancerSideOf(BOTH, 'the-seller')).toBeNull();
    expect(conveyancerSideOf(BOTH, null)).toBeNull();
    expect(conveyancerSideOf({ buyer: BUYER_FIRM, seller: BUYER_FIRM }, 'buyer-firm')).toBeNull();
  });
});

describe('conveyancerMatterPath', () => {
  it('should send a joined firm to its matter page', () => {
    expect(conveyancerMatterPath('tx_1', 'buyer', 'other')).toBe('/pro/conveyancer/matters/tx_1');
  });

  it('should leave a party on the deal page even if a slot names them', () => {
    expect(conveyancerMatterPath('tx_1', 'seller', 'seller')).toBeNull();
  });

  it('should leave everyone else alone', () => {
    expect(conveyancerMatterPath('tx_1', null, 'other')).toBeNull();
    expect(conveyancerMatterPath(undefined, 'buyer', 'other')).toBeNull();
  });
});

describe('conveyancerLines', () => {
  it('should name the buyer\'s own firm first, then the seller\'s', () => {
    expect(texts(BOTH, 'buyer', true)).toEqual([
      'Your conveyancer: Test Firm One',
      "The seller's conveyancer: Test Firm Two",
    ]);
  });

  it('should name the seller\'s own firm first, then the buyer\'s', () => {
    expect(texts(BOTH, 'seller', true)).toEqual([
      'Your conveyancer: Test Firm Two',
      "The buyer's conveyancer: Test Firm One",
    ]);
  });

  it('should tell a client with no firm yet', () => {
    expect(texts({ buyer: null, seller: SELLER_FIRM }, 'buyer', true)).toEqual([
      'Your conveyancer: not instructed yet',
      "The seller's conveyancer: Test Firm Two",
    ]);
  });

  it('should not show a buyer\'s firm to the seller before a buyer is on the deal', () => {
    expect(texts(BOTH, 'seller', false)).toEqual(['Your conveyancer: Test Firm Two']);
  });

  it('should show the agent whichever sides have a firm', () => {
    expect(texts(BOTH, 'other', true)).toEqual([
      "The seller's conveyancer: Test Firm Two",
      "The buyer's conveyancer: Test Firm One",
    ]);
    expect(texts(NO_CONVEYANCERS, 'other', true)).toEqual([]);
  });

  it('should fall back to a neutral label when the slot has no firm name', () => {
    expect(texts({ buyer: null, seller: { principal: 'p', firmName: null } }, 'seller', false)).toEqual([
      'Your conveyancer: a firm on the PropXchain panel',
    ]);
  });
});

describe('conveyancerLines keys', () => {
  it('should key each line by the side it is about', () => {
    expect(conveyancerLines(BOTH, 'buyer', true).map((l) => l.side)).toEqual(['buyer', 'seller']);
    expect(conveyancerLines(BOTH, 'other', true).map((l) => l.side)).toEqual(['seller', 'buyer']);
  });
});

describe('hasRealBuyer', () => {
  it('should be false when the buyer slot holds the seller as distinct Principal objects', () => {
    const a = principal('seller-p');
    const b = principal('seller-p');
    expect(a).not.toBe(b);
    expect(hasRealBuyer(a, b)).toBe(false);
  });

  it('should be true for a different principal, as objects or text', () => {
    expect(hasRealBuyer(principal('buyer-p'), principal('seller-p'))).toBe(true);
    expect(hasRealBuyer('buyer-p', 'seller-p')).toBe(true);
  });

  it('should be false with no buyer at all', () => {
    expect(hasRealBuyer(null, 'seller-p')).toBe(false);
    expect(hasRealBuyer(undefined, undefined)).toBe(false);
  });
});
