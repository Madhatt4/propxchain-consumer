import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../../../stores/authStore';
import { getPostLoginRoute } from '../postLoginRoute';
import { storePendingInviteUrl } from '../../../utils/pendingInviteUrl';

const setAuth = (over: Record<string, unknown>): void => {
  useAuthStore.setState({
    orgJustCreated: false, principalId: null, authMethod: 'supabase',
    supabaseUser: null, ...over,
  });
};

beforeEach(() => {
  localStorage.clear();
});

describe('getPostLoginRoute', () => {
  it('should honour an explicit from path', () => {
    setAuth({});
    expect(getPostLoginRoute('/dashboard/settings')).toBe('/dashboard/settings');
  });

  it('should send a roleless Supabase user to /profile-setup (social signup gate)', () => {
    setAuth({ supabaseUser: { user_metadata: {} } });
    expect(getPostLoginRoute()).toBe('/profile-setup');
  });

  it('should send a solicitor to /conveyancer', () => {
    setAuth({ supabaseUser: { user_metadata: { role: 'solicitor' } } });
    expect(getPostLoginRoute()).toBe('/conveyancer');
  });

  it('should send a non-onboarded seller to /start-transaction', () => {
    setAuth({ supabaseUser: { user_metadata: { role: 'seller' } } });
    expect(getPostLoginRoute()).toBe('/start-transaction');
  });

  it('should send an II user to /dashboard', () => {
    setAuth({ authMethod: 'ii', supabaseUser: null });
    expect(getPostLoginRoute()).toBe('/dashboard');
  });

  it('should send a non-onboarded buyer to /onboarding/join', () => {
    setAuth({ supabaseUser: { user_metadata: { role: 'buyer' } } });
    expect(getPostLoginRoute()).toBe('/onboarding/join');
  });

  it('should send an already-onboarded seller to /post-login', () => {
    setAuth({ supabaseUser: { user_metadata: { role: 'seller', propxchain_onboarded: true } } });
    expect(getPostLoginRoute()).toBe('/post-login');
  });

  it('should send the user back to a pending invite URL ahead of the role/decideRoute answer', () => {
    setAuth({ supabaseUser: { user_metadata: { role: 'seller', propxchain_onboarded: true } } });
    storePendingInviteUrl('/join/TX-1234-ABCD?role=seller&side=seller&by=aaa');
    expect(getPostLoginRoute()).toBe('/join/TX-1234-ABCD?role=seller&side=seller&by=aaa');
  });

  it('should send the user back to a pending invite URL ahead of an explicit from path', () => {
    setAuth({});
    storePendingInviteUrl('/join/TX-1234-ABCD?role=buyer');
    expect(getPostLoginRoute('/dashboard/settings')).toBe('/join/TX-1234-ABCD?role=buyer');
  });

  it('should only consume the pending invite URL once', () => {
    setAuth({ supabaseUser: { user_metadata: { role: 'seller', propxchain_onboarded: true } } });
    storePendingInviteUrl('/join/TX-1234-ABCD');
    expect(getPostLoginRoute()).toBe('/join/TX-1234-ABCD');
    expect(getPostLoginRoute()).toBe('/post-login');
  });
});
