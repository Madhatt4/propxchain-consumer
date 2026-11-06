import { describe, it, expect } from 'vitest';
import { isDealParty, keysRoleOf } from '../completionRoles';

describe('isDealParty', () => {
  const parties = {
    seller: 'seller-1', buyer: 'buyer-1', sellers: ['seller-2'], buyers: ['buyer-2'],
    delegates: [['seller-1', 'agent-1']] as Array<[string, string]>,
  };

  it('should count buyer and seller parties, including joint ones', () => {
    for (const p of ['seller-1', 'seller-2', 'buyer-1', 'buyer-2']) expect(isDealParty(parties, p)).toBe(true);
  });

  it('should not count a delegate, a stranger or no principal', () => {
    expect(isDealParty(parties, 'agent-1')).toBe(false);
    expect(isDealParty(parties, 'stranger')).toBe(false);
    expect(isDealParty(parties, null)).toBe(false);
  });

  it('should not treat the no-buyer placeholder as a buyer', () => {
    expect(isDealParty({ seller: 'seller-1', buyer: 'seller-1' }, 'seller-1')).toBe(true);
    expect(isDealParty({ seller: 'seller-1', buyer: 'seller-1' }, 'buyer-x')).toBe(false);
  });
});

describe('keysRoleOf', () => {
  const base = { seller: 'seller-1', buyer: 'buyer-1', sellers: ['seller-2'] };

  it('should treat a delegate of any seller party as the agent', () => {
    expect(keysRoleOf({ ...base, delegates: [['seller-2', 'agent-1']] }, 'agent-1')).toBe('agent');
  });

  it('should let a seller confirm only when no seller party has an agent', () => {
    expect(keysRoleOf({ ...base, delegates: [] }, 'seller-1')).toBe('seller');
    expect(keysRoleOf({ ...base, delegates: [['seller-1', 'agent-1']] }, 'seller-2')).toBe('seller-with-agent');
  });

  it('should give no keys role to the buyer side, a buyer delegate or a stranger', () => {
    const parties = { ...base, delegates: [['buyer-1', 'buyer-agent']] as Array<[string, string]> };
    expect(keysRoleOf(parties, 'buyer-1')).toBe('none');
    expect(keysRoleOf(parties, 'buyer-agent')).toBe('none');
    expect(keysRoleOf(parties, 'stranger')).toBe('none');
    expect(keysRoleOf(parties, null)).toBe('none');
  });
});
