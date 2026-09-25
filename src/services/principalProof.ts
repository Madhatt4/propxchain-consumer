// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * principalProof — prove to an edge function that this browser controls the
 * caller's ICP principal (#130). The server never trusts the self-asserted
 * user_metadata.icp_principal: it reconstructs the principal from
 * publicKeyDer and checks a real signature over a purpose-specific message
 * that it recomputes from its own inputs (typically binding the JWT user id,
 * so a captured proof is worthless from another account).
 *
 * Email/password accounts hold an Ed25519 self-key, which is what signs here.
 * Internet Identity returns a delegation whose session key derives a different
 * principal, so it cannot satisfy this proof — a known follow-up, not
 * reachable today: every consumer of this proof is Supabase-JWT-authed, and
 * II-only users have no Supabase session.
 */
import { Ed25519KeyIdentity } from '@propxchain/core-client';
import { icpService } from './icp.service';

export interface PrincipalProof {
  principal: string;
  /** base64 DER (SPKI) */
  publicKeyDer: string;
  /** base64 Ed25519 signature over the UTF-8 message */
  signature: string;
}

function bytesToBase64(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Sign `message` with the signed-in identity's self-key. Throws `no_identity` / `unsupported_identity`. */
export async function buildPrincipalProof(message: string): Promise<PrincipalProof> {
  const identity = await icpService.getAuthenticatedIdentity();
  if (!identity) throw new Error('no_identity');

  const keyIdentity = identity as unknown as Ed25519KeyIdentity;
  if (typeof keyIdentity.sign !== 'function' || typeof keyIdentity.getPublicKey !== 'function') {
    throw new Error('unsupported_identity');
  }

  // Sign the Uint8Array itself, not message.buffer — core-client's identity
  // takes a Uint8Array and rejects a raw ArrayBuffer at runtime ("message
  // must be hex string or Uint8Array").
  const signature = await keyIdentity.sign(new TextEncoder().encode(message));

  return {
    principal: keyIdentity.getPrincipal().toText(),
    publicKeyDer: bytesToBase64(keyIdentity.getPublicKey().toDer()),
    signature: bytesToBase64(signature),
  };
}
