import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCompleteOAuthSession = vi.fn();
const mockRetryKeyGeneration = vi.fn();
vi.mock('../../services/supabase.auth.service', () => ({
  supabaseAuthService: {
    completeOAuthSession: () => mockCompleteOAuthSession(),
    retryKeyGeneration: (id: string) => mockRetryKeyGeneration(id),
  },
}));

const mockSetIdentity = vi.fn().mockResolvedValue(undefined);
const mockEnsureProfile = vi.fn().mockResolvedValue(undefined);
const mockGetMyProfile = vi.fn().mockResolvedValue(null);
const mockIcpInitialize = vi.fn().mockResolvedValue(undefined);
vi.mock('../../services/icp.service', () => ({
  icpService: {
    setIdentity: () => mockSetIdentity(),
    ensureUserProfileOnChain: (a: unknown) => mockEnsureProfile(a),
    getMyProfile: () => mockGetMyProfile(),
    initialize: () => mockIcpInitialize(),
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { useAuthStore } from '../authStore';

const fakeIdentity = { getPrincipal: () => ({ toText: () => 'aaaaa-bbbbb' }) };

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({
    isAuthenticated: false, authMethod: null, principal: null, principalId: null,
    supabaseUser: null, isLoading: false, error: null,
  });
});

describe('completeOAuthLogin', () => {
  it('should authenticate and set authMethod to supabase on success', async () => {
    mockCompleteOAuthSession.mockResolvedValue({
      user: { id: 'u1', email: 'a@b.com', user_metadata: { role: 'seller', name: 'A B' } },
      session: {}, identity: fakeIdentity, error: null,
    });
    const ok = await useAuthStore.getState().completeOAuthLogin();
    expect(ok).toBe(true);
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(true);
    expect(s.authMethod).toBe('supabase');
    expect(s.principalId).toBe('aaaaa-bbbbb');
  });

  it('should mirror the profile to chain when a role is present', async () => {
    mockCompleteOAuthSession.mockResolvedValue({
      user: { id: 'u1', email: 'a@b.com', user_metadata: { role: 'seller', name: 'A B' } },
      session: {}, identity: fakeIdentity, error: null,
    });
    await useAuthStore.getState().completeOAuthLogin();
    expect(mockEnsureProfile).toHaveBeenCalled();
  });

  it('should NOT mirror to chain when the user has no role yet (social sign-up)', async () => {
    mockCompleteOAuthSession.mockResolvedValue({
      user: { id: 'u1', email: 'a@b.com', user_metadata: { name: 'A B' } },
      session: {}, identity: fakeIdentity, error: null,
    });
    await useAuthStore.getState().completeOAuthLogin();
    expect(mockEnsureProfile).not.toHaveBeenCalled();
  });

  it('should fail when no identity can be established', async () => {
    mockCompleteOAuthSession.mockResolvedValue({
      user: { id: 'u1', email: 'a@b.com', user_metadata: {} },
      session: {}, identity: null, error: null,
    });
    mockRetryKeyGeneration.mockResolvedValue(null);
    const ok = await useAuthStore.getState().completeOAuthLogin();
    expect(ok).toBe(false);
    expect(useAuthStore.getState().error).toBeTruthy();
  });
});
