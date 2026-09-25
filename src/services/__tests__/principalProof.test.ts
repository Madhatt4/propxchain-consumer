import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Ed25519KeyIdentity, Principal } from '@propxchain/core-client';

const mockGetAuthenticatedIdentity = vi.fn();
vi.mock('../icp.service', () => ({
  icpService: { getAuthenticatedIdentity: () => mockGetAuthenticatedIdentity() },
}));

import { buildPrincipalProof } from '../principalProof';

// A real key: the proof is a real signature, so what the edge function
// verifies is exactly what this exercises.
const identity = Ed25519KeyIdentity.generate();

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAuthenticatedIdentity.mockResolvedValue(identity);
});

describe('buildPrincipalProof', () => {
  it('should sign the message with the self-key and report the principal that key derives', async () => {
    const proof = await buildPrincipalProof('record-party-role:tx_1:user-1');

    const der = fromBase64(proof.publicKeyDer);
    expect(proof.principal).toBe(identity.getPrincipal().toText());
    expect(Principal.selfAuthenticating(der).toText()).toBe(proof.principal);
    const valid = Ed25519KeyIdentity.verify(
      fromBase64(proof.signature),
      new TextEncoder().encode('record-party-role:tx_1:user-1'),
      identity.getPublicKey().toRaw(),
    );
    expect(valid).toBe(true);
  });

  it('should produce a signature that does not verify over a different message', async () => {
    const proof = await buildPrincipalProof('record-party-role:tx_1:user-1');
    const valid = Ed25519KeyIdentity.verify(
      fromBase64(proof.signature),
      new TextEncoder().encode('record-party-role:tx_1:user-2'),
      identity.getPublicKey().toRaw(),
    );
    expect(valid).toBe(false);
  });

  it('should throw no_identity when nobody is signed in', async () => {
    mockGetAuthenticatedIdentity.mockResolvedValueOnce(null);
    await expect(buildPrincipalProof('m')).rejects.toThrow('no_identity');
  });

  it('should throw unsupported_identity for a delegation-style identity without a raw key', async () => {
    mockGetAuthenticatedIdentity.mockResolvedValueOnce({ getPrincipal: () => identity.getPrincipal() });
    await expect(buildPrincipalProof('m')).rejects.toThrow('unsupported_identity');
  });
});
