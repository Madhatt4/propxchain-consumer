// A brand-new ICP key is only useful if its encrypted blob lands in the
// user's metadata. supabase.auth.updateUser reports failure in `error`, it
// does not throw, so an unchecked call handed the caller an identity that the
// next sign-in could never restore — and that sign-in minted a different one.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGenerate, mockUpdateUser, mockGetUser } = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock('../keyPair.service', () => ({
  KeyPairService: {
    generateAndEncrypt: (id: string) => mockGenerate(id),
    decryptAndRestore: vi.fn(),
    parseEnvelope: vi.fn(),
  },
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      updateUser: (args: unknown) => mockUpdateUser(args),
      getUser: () => mockGetUser(),
    },
    from: () => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })),
    }),
    rpc: vi.fn().mockResolvedValue({ error: null }),
    functions: { invoke: vi.fn() },
  },
}));

import { supabaseAuthService } from '../supabase.auth.service';

const NEW_USER = { id: 'u-new', email: 'new@example.com', user_metadata: {} };
const SESSION = { access_token: 't', user: NEW_USER };
const identity = { getPrincipal: () => ({ toText: () => 'p-new' }) };

describe('saving a newly generated ICP key', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerate.mockResolvedValue({ identity, encryptedKey: 'v2.1.BLOB' });
    mockGetUser.mockResolvedValue({ data: { user: NEW_USER } });
  });

  it('should not hand back an identity when the key blob fails to save at first login', async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: 'network down' } });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the Supabase User/Session types
    const result = await supabaseAuthService._completePostAuthSetup(NEW_USER as any, SESSION as any);

    expect(result.identity).toBeNull();
    expect(result.failureReason).toBe('no_key');
  });

  it('should return the identity when the key blob saves', async () => {
    mockUpdateUser.mockResolvedValue({ error: null });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the Supabase User/Session types
    const result = await supabaseAuthService._completePostAuthSetup(NEW_USER as any, SESSION as any);

    expect(result.identity).toBe(identity);
  });

  it('should report failure from retryKeyGeneration when the blob fails to save', async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: 'network down' } });

    const retried = await supabaseAuthService.retryKeyGeneration('u-new');

    expect(retried).toBeNull();
  });
});
