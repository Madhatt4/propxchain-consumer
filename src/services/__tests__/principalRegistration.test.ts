import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Ed25519KeyIdentity, Principal } from '@propxchain/core-client';

const mockInvoke = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));
vi.mock('../icp.service', () => ({ icpService: { getAuthenticatedIdentity: vi.fn() } }));
vi.mock('../../utils/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

import { registerPrincipalMessage, registerVerifiedPrincipal } from '../principalRegistration';

const identity = Ed25519KeyIdentity.generate();

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
});

describe('registerPrincipalMessage', () => {
  it('should bind the purpose and the user id', () => {
    expect(registerPrincipalMessage('user-1')).toBe('register-principal:user-1');
  });
});

describe('registerVerifiedPrincipal', () => {
  it('should send a proof signed over the user-bound message', async () => {
    // Arrange / Act
    const ok = await registerVerifiedPrincipal(identity, 'user-1');

    // Assert
    expect(ok).toBe(true);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    const [fn, options] = mockInvoke.mock.calls[0] as [string, { body: Record<string, string> }];
    expect(fn).toBe('register-principal');
    expect(options.body.principal).toBe(identity.getPrincipal().toText());
    expect(Principal.selfAuthenticating(fromBase64(options.body.publicKeyDer)).toText()).toBe(
      options.body.principal,
    );
    const valid = Ed25519KeyIdentity.verify(
      fromBase64(options.body.signature),
      new TextEncoder().encode('register-principal:user-1'),
      identity.getPublicKey().toRaw(),
    );
    expect(valid).toBe(true);
  });

  it('should not verify for a different user id', async () => {
    await registerVerifiedPrincipal(identity, 'user-1');
    const [, options] = mockInvoke.mock.calls[0] as [string, { body: Record<string, string> }];
    const valid = Ed25519KeyIdentity.verify(
      fromBase64(options.body.signature),
      new TextEncoder().encode('register-principal:user-2'),
      identity.getPublicKey().toRaw(),
    );
    expect(valid).toBe(false);
  });

  it('should return false when the edge function refuses', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'principal_unverified' } });
    expect(await registerVerifiedPrincipal(identity, 'user-1')).toBe(false);
  });

  it('should return false, not throw, when the call itself fails', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('network'));
    expect(await registerVerifiedPrincipal(identity, 'user-1')).toBe(false);
  });

  it('should return false for an identity that cannot sign', async () => {
    const delegation = { getPrincipal: () => identity.getPrincipal() } as unknown as Ed25519KeyIdentity;
    expect(await registerVerifiedPrincipal(delegation, 'user-1')).toBe(false);
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
