// The funnel test. authStore reads a null identity as "half-written key" and
// calls retryKeyGeneration; under v2 a wrong pepper / stale version / rollback
// all arrive here with a VALID blob present. If regeneration runs, the user's
// on-chain identity is destroyed silently. Uses the REAL supabaseAuthService —
// mocking it here would mock away the guard under test.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock factories are hoisted above ordinary declarations, so everything
// they reference must be hoisted too.
const { mockGenerate, mockRestore, mockUpdateUser, USER_WITH_KEY, SESSION } = vi.hoisted(() => {
  const userWithKey = {
    id: 'u1',
    email: 'a@b.com',
    user_metadata: { encrypted_icp_key: 'EXISTING_BLOB', icp_principal: 'p-old' },
  };
  return {
    mockGenerate: vi.fn(),
    mockRestore: vi.fn(),
    mockUpdateUser: vi.fn(),
    USER_WITH_KEY: userWithKey,
    SESSION: { access_token: 't', user: userWithKey },
  };
});

vi.mock('../../services/keyPair.service', () => ({
  KeyPairService: {
    generateAndEncrypt: (id: string) => mockGenerate(id),
    decryptAndRestore: (k: string, id: string) => mockRestore(k, id),
  },
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: USER_WITH_KEY, session: SESSION },
        error: null,
      }),
      getSession: vi.fn().mockResolvedValue({ data: { session: SESSION }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: USER_WITH_KEY }, error: null }),
      updateUser: (args: unknown) => mockUpdateUser(args),
    },
    from: () => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })),
    }),
    rpc: vi.fn().mockResolvedValue({ error: null }),
  },
}));

vi.mock('../../services/icp.service', () => ({
  icpService: {
    setIdentity: vi.fn(),
    ensureUserProfileOnChain: vi.fn(),
    getMyProfile: vi.fn().mockResolvedValue(null),
    initialize: vi.fn(),
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { useAuthStore } from '../authStore';

describe('authStore never regenerates over an existing key', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateUser.mockResolvedValue({ error: null });
    mockRestore.mockRejectedValue(new Error('decrypt failed — wrong pepper'));
    useAuthStore.setState({
      isAuthenticated: false, authMethod: null, principal: null, principalId: null,
      supabaseUser: null, isLoading: false, error: null,
    });
  });

  it('should NOT regenerate on the email path when restore fails with a blob present', async () => {
    const ok = await useAuthStore.getState().loginWithEmail('a@b.com', 'pw');

    expect(ok).toBe(false);
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(useAuthStore.getState().error).toBeTruthy();
  });

  it('should NOT regenerate on the OAuth path when restore fails with a blob present', async () => {
    const ok = await useAuthStore.getState().completeOAuthLogin();

    expect(ok).toBe(false);
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});
