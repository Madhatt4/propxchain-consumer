import { describe, expect, it } from 'vitest';
import { canRemoveBot } from '../botOwnership';

const ME = 'owner-principal';
const BOT = 'bot-principal';

describe('canRemoveBot', () => {
  it('lets the owner of a self-joined bot remove it (addedBy is the bot itself)', () => {
    expect(canRemoveBot({ addedBy: BOT, ownerPrincipal: ME }, ME)).toBe(true);
  });

  it('does not let another participant remove a bot they do not own', () => {
    expect(canRemoveBot({ addedBy: BOT, ownerPrincipal: 'someone-else' }, ME)).toBe(false);
  });

  it('does not let the person who added a bot remove it once it has a different owner', () => {
    expect(canRemoveBot({ addedBy: ME, ownerPrincipal: 'someone-else' }, ME)).toBe(false);
  });

  it('falls back to addedBy for records written before owner attribution', () => {
    expect(canRemoveBot({ addedBy: ME, ownerPrincipal: null }, ME)).toBe(true);
    expect(canRemoveBot({ addedBy: BOT, ownerPrincipal: null }, ME)).toBe(false);
  });

  it('says no when nobody is signed in', () => {
    expect(canRemoveBot({ addedBy: BOT, ownerPrincipal: ME }, null)).toBe(false);
    expect(canRemoveBot({ addedBy: BOT, ownerPrincipal: ME }, undefined)).toBe(false);
  });
});
