import { describe, expect, it } from 'vitest';
import { canRemoveBot } from '../botOwnership';

const ME = 'owner-principal';

describe('canRemoveBot', () => {
  it('lets the owner of a self-joined bot remove it', () => {
    expect(canRemoveBot({ ownerPrincipal: ME }, ME)).toBe(true);
  });

  it('does not let another participant remove a bot they do not own', () => {
    expect(canRemoveBot({ ownerPrincipal: 'someone-else' }, ME)).toBe(false);
  });

  it('lets any participant remove a record from before owner attribution', () => {
    expect(canRemoveBot({ ownerPrincipal: null }, ME)).toBe(true);
  });

  it('says no when nobody is signed in', () => {
    expect(canRemoveBot({ ownerPrincipal: ME }, null)).toBe(false);
    expect(canRemoveBot({ ownerPrincipal: null }, undefined)).toBe(false);
  });
});
