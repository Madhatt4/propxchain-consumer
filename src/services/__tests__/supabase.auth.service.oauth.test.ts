import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSignInWithOAuth = vi.fn();
const mockGetSession = vi.fn();
const mockUpdateUser = vi.fn().mockResolvedValue({ data: {}, error: null });
const mockFrom = vi.fn((_table: string) => ({
  upsert: vi.fn().mockResolvedValue({ error: null }),
  select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })),
}));
const mockRpc = vi.fn().mockResolvedValue({ error: null });

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: (args: unknown) => mockSignInWithOAuth(args),
      getSession: () => mockGetSession(),
      updateUser: (args: unknown) => mockUpdateUser(args),
    },
    from: (t: string) => mockFrom(t),
    rpc: (n: string, a: unknown) => mockRpc(n, a),
  },
}));

const mockGenerate = vi.fn();
const mockRestore = vi.fn();
vi.mock('../keyPair.service', () => ({
  KeyPairService: {
    generateAndEncrypt: (id: string) => mockGenerate(id),
    decryptAndRestore: (k: string, id: string) => mockRestore(k, id),
  },
}));

import { supabaseAuthService } from '../supabase.auth.service';

const fakeIdentity = {
  getPrincipal: () => ({ toText: () => 'aaaaa-bbbbb-ccccc' }),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSignInWithOAuth.mockResolvedValue({ data: {}, error: null });
});

describe('signInWithOAuth', () => {
  it('should call Supabase with the google provider and the callback redirect', async () => {
    await supabaseAuthService.signInWithOAuth('google');
    expect(mockSignInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google',
        options: expect.objectContaining({
          redirectTo: expect.stringContaining('/auth/callback'),
        }),
      }),
    );
  });

  it('should call Supabase with the azure provider for Microsoft', async () => {
    await supabaseAuthService.signInWithOAuth('azure');
    expect(mockSignInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'azure' }),
    );
  });
});

describe('completeOAuthSession', () => {
  it('should return an error when there is no session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    const result = await supabaseAuthService.completeOAuthSession();
    expect(result.identity).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it('should generate a new ICP key when the user has none', async () => {
    const user = { id: 'u1', email: 'a@b.com', user_metadata: {} };
    mockGetSession.mockResolvedValue({ data: { session: { user } }, error: null });
    mockGenerate.mockResolvedValue({ identity: fakeIdentity, encryptedKey: 'ENC' });
    const result = await supabaseAuthService.completeOAuthSession();
    expect(mockGenerate).toHaveBeenCalledWith('u1');
    expect(result.identity).toBe(fakeIdentity);
    expect(result.error).toBeNull();
  });

  it('should restore the ICP key when the user already has one', async () => {
    const user = { id: 'u1', email: 'a@b.com', user_metadata: { encrypted_icp_key: 'ENC' } };
    mockGetSession.mockResolvedValue({ data: { session: { user } }, error: null });
    mockRestore.mockResolvedValue(fakeIdentity);
    const result = await supabaseAuthService.completeOAuthSession();
    expect(mockRestore).toHaveBeenCalledWith('ENC', 'u1');
    expect(result.identity).toBe(fakeIdentity);
  });
});
