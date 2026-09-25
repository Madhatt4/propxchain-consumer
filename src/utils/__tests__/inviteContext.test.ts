import { describe, it, expect } from 'vitest';
import { withInviteContext, readInviteContext } from '../inviteContext';

describe('inviteContext', () => {
  it('should round-trip role, side and inviter through a join URL', () => {
    const url = withInviteContext('https://app.example/join/TX-AAAA-BBBB?rm=x', {
      role: 'estate_agent',
      side: 'seller',
      invitedBy: 'aaaaa-bbbbb',
    });
    const params = new URL(url).searchParams;
    expect(params.get('rm')).toBe('x');
    expect(readInviteContext(params)).toEqual({ role: 'estate_agent', side: 'seller', invitedBy: 'aaaaa-bbbbb' });
  });

  it('should leave the URL untouched with no context and drop unknown values on read', () => {
    expect(withInviteContext('https://app.example/join/TX-1', {})).toBe('https://app.example/join/TX-1');
    expect(readInviteContext(new URLSearchParams('role=hacker&side=left'))).toEqual({});
  });

  it('should round-trip role=seller through a join URL', () => {
    const url = withInviteContext('https://app.example/join/TX-1111-2222', {
      role: 'seller',
      side: 'seller',
      invitedBy: 'aaaa-bb',
    });
    const params = new URL(url).searchParams;
    expect(readInviteContext(params)).toEqual({ role: 'seller', side: 'seller', invitedBy: 'aaaa-bb' });
  });

  it('should drop unknown role=wizard on read', () => {
    expect(readInviteContext(new URLSearchParams('role=wizard'))).toEqual({});
  });
});
