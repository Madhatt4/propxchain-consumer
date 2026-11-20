// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, expect, it } from 'vitest';
import { buyerInviteState, hasBuyerJoined } from '../buyerInvite';

const SELLER = 'seller-p';
const BUYER = 'buyer-p';
const AGENT = 'agent-p';

describe('hasBuyerJoined', () => {
  it('should be false while the seller still fills the buyer slot', () => {
    expect(hasBuyerJoined({ seller: SELLER, buyer: SELLER })).toBe(false);
  });

  it('should be false when the buyer slot is empty', () => {
    expect(hasBuyerJoined({ seller: SELLER, buyer: null })).toBe(false);
  });

  it('should be true once a different principal holds the buyer slot', () => {
    expect(hasBuyerJoined({ seller: SELLER, buyer: BUYER })).toBe(true);
  });

  it('should be true when the multi-party buyers list has someone', () => {
    expect(hasBuyerJoined({ seller: SELLER, buyer: SELLER, buyers: [BUYER] })).toBe(true);
  });
});

describe('buyerInviteState', () => {
  it('should let the seller share the code before a buyer joins', () => {
    expect(buyerInviteState({ seller: SELLER, buyer: SELLER }, SELLER)).toBe('share');
  });

  it('should let an agent acting for the seller share the code', () => {
    const parties = { seller: SELLER, buyer: SELLER, delegates: [[SELLER, AGENT]] as const };
    expect(buyerInviteState(parties, AGENT)).toBe('share');
  });

  it('should report the code as used once the buyer has joined', () => {
    expect(buyerInviteState({ seller: SELLER, buyer: BUYER }, SELLER)).toBe('buyerJoined');
  });

  it('should never give the code to the buyer', () => {
    expect(buyerInviteState({ seller: SELLER, buyer: BUYER }, BUYER)).toBe('notSellerSide');
  });

  it('should never give the code to an agent acting for the buyer', () => {
    const parties = { seller: SELLER, buyer: BUYER, delegates: [[BUYER, AGENT]] as const };
    expect(buyerInviteState(parties, AGENT)).toBe('notSellerSide');
  });
});
