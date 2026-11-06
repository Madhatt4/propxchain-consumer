import { describe, it, expect } from 'vitest';
import { keysRoleOf } from '../completionRoles';

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
