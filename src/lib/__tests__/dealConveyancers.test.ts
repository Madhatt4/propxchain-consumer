// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import {
  conveyancerMatterPath,
  conveyancerOfSlot,
  conveyancerSideOf,
  dealConveyancersOf,
  NO_CONVEYANCERS,
} from '../dealConveyancers';

const BUYER_FIRM = { principal: 'buyer-firm', firmName: 'Test Firm One' };
const SELLER_FIRM = { principal: 'seller-firm', firmName: 'Test Firm Two' };
const BOTH = { buyer: BUYER_FIRM, seller: SELLER_FIRM };

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
