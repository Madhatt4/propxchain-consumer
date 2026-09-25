// The security-critical client test. A restore failure while a blob EXISTS must
// never reach generateAndEncrypt/updateUser — that path silently destroys the
// user's on-chain identity. The funnel lives in authStore, so a service-level
// test cannot catch it; authStore.regeneration-guard.test.ts drives the store.
// These tests prove the guard's own logic at the service level.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGenerate = vi.fn();
const mockRestore = vi.fn();
const mockParseEnvelope = vi.fn();
const mockReEncrypt = vi.fn();
vi.mock('../keyPair.service', () => ({
  KeyPairService: {
    generateAndEncrypt: (id: string) => mockGenerate(id),
    decryptAndRestore: (k: string, id: string) => mockRestore(k, id),
    parseEnvelope: (blob: string) => mockParseEnvelope(blob),
    reEncryptToV2: (identity: unknown) => mockReEncrypt(identity),
  },
}));

const mockUpdateUser = vi.fn();
const mockGetSession = vi.fn();
const mockGetUser = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      updateUser: (args: unknown) => mockUpdateUser(args),
      getSession: () => mockGetSession(),
      getUser: () => mockGetUser(),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      }),
    },
    from: () => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })),
    }),
    rpc: vi.fn().mockResolvedValue({ error: null }),
  },
}));

import { supabaseAuthService } from '../supabase.auth.service';

const USER_WITH_KEY = {
  id: 'u1',
  email: 'a@b.com',
  user_metadata: { encrypted_icp_key: 'EXISTING_BLOB', icp_principal: 'p-old' },
};

describe('retryKeyGeneration regeneration guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateUser.mockResolvedValue({ error: null });
  });

  it('should refuse to regenerate when an encrypted key already exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: USER_WITH_KEY }, error: null });

    const result = await supabaseAuthService.retryKeyGeneration('u1');

    expect(result).toBeNull();
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('should regenerate when no encrypted key exists (the real race it was built for)', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com', user_metadata: {} } },
      error: null,
    });
    const fakeIdentity = { getPrincipal: () => ({ toText: () => 'p-new' }) };
    mockGenerate.mockResolvedValue({ identity: fakeIdentity, encryptedKey: 'NEW_BLOB' });

    const result = await supabaseAuthService.retryKeyGeneration('u1');

    expect(result).toBe(fakeIdentity);
    expect(mockGenerate).toHaveBeenCalledWith('u1');
    expect(mockUpdateUser).toHaveBeenCalled();
  });
});

describe('_completePostAuthSetup typed failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateUser.mockResolvedValue({ error: null });
  });

  it('should report restore_failed (not no_key) when a blob exists but will not decrypt', async () => {
    mockRestore.mockRejectedValue(new Error('decrypt failed'));

    const result = await supabaseAuthService._completePostAuthSetup(
      USER_WITH_KEY as never,
      { access_token: 't' } as never,
    );

    expect(result.identity).toBeNull();
    expect(result.failureReason).toBe('restore_failed');
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('should report no_key when the user has no blob and keygen fails', async () => {
    mockGenerate.mockRejectedValue(new Error('keygen failed'));

    const result = await supabaseAuthService._completePostAuthSetup(
      { id: 'u1', email: 'a@b.com', user_metadata: {} } as never,
      { access_token: 't' } as never,
    );

    expect(result.identity).toBeNull();
    expect(result.failureReason).toBe('no_key');
  });
});

describe('restoreIdentity split', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return null when the user genuinely has no key', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1', user_metadata: {} } },
      error: null,
    });
    await expect(supabaseAuthService.restoreIdentity()).resolves.toBeNull();
  });

  it('should throw (not silently return null) when a blob exists but will not decrypt', async () => {
    mockGetUser.mockResolvedValue({ data: { user: USER_WITH_KEY }, error: null });
    mockRestore.mockRejectedValue(new Error('oracle unreachable'));

    await expect(supabaseAuthService.restoreIdentity()).rejects.toThrow();
  });
});

describe('migration write-back failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should still return the identity when the v2 write-back fails', async () => {
    // The "a migration failure must never block a login" promise.
    const fakeIdentity = { getPrincipal: () => ({ toText: () => 'p1' }) };
    mockRestore.mockResolvedValue(fakeIdentity);
    mockParseEnvelope.mockReturnValue({ version: 1 });
    mockReEncrypt.mockResolvedValue('v2.1.MIGRATED');
    mockUpdateUser.mockRejectedValue(new Error('updateUser rejected'));

    const result = await supabaseAuthService._completePostAuthSetup(
      { id: 'u1', email: 'a@b.com', user_metadata: { encrypted_icp_key: btoa('x'.repeat(40)) } } as never,
      { access_token: 't' } as never,
    );

    expect(result.identity).toBe(fakeIdentity);
    // The migration was genuinely attempted before the write-back failed.
    expect(mockReEncrypt).toHaveBeenCalled();
  });
});
