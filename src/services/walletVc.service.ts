// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2025 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * Wallet VC (Verifiable Credential) service.
 *
 * Supports OpenID4VP presentation requests and verification via a server-side
 * proxy. Set VITE_VC_VERIFIER_URL to the proxy base. With no proxy configured
 * we return bundled sample data so the VC tab renders in dev / offline.
 */

import { logger } from '@/utils/logger';

const BASE = import.meta.env.VITE_VC_VERIFIER_URL as string | undefined;

export interface PresentationRequest { request: string; requestedClaims: string[]; }
export interface VerifyResult {
  verified: boolean;
  reason?: 'signature' | 'issuer' | 'revoked';
  claims?: Record<string, unknown>;
  credentialType?: string;
  issuer?: string;
  provenance?: { alg: string; kid?: string; verifiedAt: string };
}

const SAMPLE_REQUEST: PresentationRequest = {
  request: 'openid4vp://?txId=sample&type=MortgageOfferCredential',
  requestedClaims: ['lender', 'offerReference', 'propertyAddress', 'offerAmountPence'],
};

const SAMPLE_VERIFIED: VerifyResult = {
  verified: true,
  claims: { lender: 'Halifax', offerReference: 'HX-2026-884213', propertyAddress: '78 Durley Avenue, Pinner HA5 1JH', offerAmountPence: 41200000 },
  credentialType: 'MortgageOfferCredential',
  issuer: 'did:web:test-bank.example',
  provenance: { alg: 'ES256', kid: 'test-issuer-key-1', verifiedAt: new Date().toISOString() },
};

export type WalletVcMode = 'live' | 'demo' | 'unavailable';

/**
 * How the Wallet (VC) UI should behave:
 * - `live`   — a verifier proxy is configured; do real verification.
 * - `demo`   — dev / test / explicit VITE_VC_DEMO; render the bundled sample.
 * - `unavailable` — prod with no proxy: render an empty state, NEVER sample data.
 */
export function walletVcMode(): WalletVcMode {
  if (BASE) return 'live';
  const demo =
    import.meta.env.DEV === true ||
    import.meta.env.MODE === 'test' ||
    import.meta.env.VITE_VC_DEMO === 'true';
  return demo ? 'demo' : 'unavailable';
}

export async function getPresentationRequest(txId: string): Promise<PresentationRequest> {
  if (!BASE) {
    logger.warn('[walletVc] VITE_VC_VERIFIER_URL not set — returning sample presentation request (demo mode)');
    return SAMPLE_REQUEST;
  }
  const r = await fetch(`${BASE}/vc/present-request?txId=${encodeURIComponent(txId)}`);
  if (!r.ok) throw new Error(`present-request failed: ${r.status}`);
  return r.json() as Promise<PresentationRequest>;
}

/**
 * Verify a presented credential against the proxy.
 * @param _txId reserved for Phase C — the on-chain proof-of-use write needs it.
 * @param jwt the presented credential. The sentinel `'SAMPLE'` short-circuits to
 *   bundled sample data (demo) even when a proxy is configured, so the slice-1 UI
 *   never sends the placeholder to a live verifier.
 */
export async function verifyPresented(_txId: string, jwt: string): Promise<VerifyResult> {
  if (jwt === 'SAMPLE') return SAMPLE_VERIFIED;
  if (!BASE) {
    logger.warn('[walletVc] VITE_VC_VERIFIER_URL not set — returning verified sample (demo mode)');
    return SAMPLE_VERIFIED;
  }
  const r = await fetch(`${BASE}/vc/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jwt }) });
  if (!r.ok) throw new Error(`verify failed: ${r.status}`);
  return r.json() as Promise<VerifyResult>;
}
