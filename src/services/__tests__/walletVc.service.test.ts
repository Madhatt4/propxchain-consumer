// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2025 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getPresentationRequest, verifyPresented, walletVcMode, type VerifyResult } from '@/services/walletVc.service';

describe('walletVc.service', () => {
  beforeEach(() => { vi.unstubAllGlobals(); delete import.meta.env.VITE_VC_VERIFIER_URL; });

  it('returns a bundled sample presentation request when no proxy is set', async () => {
    const r = await getPresentationRequest('tx-1');
    expect(r.requestedClaims).toContain('lender');
    expect(typeof r.request).toBe('string');
  });

  it('returns a bundled verified sample when no proxy is set', async () => {
    const r: VerifyResult = await verifyPresented('tx-1', 'SAMPLE');
    expect(r.verified).toBe(true);
    expect(r.claims?.lender).toBe('Halifax');
  });
});

// A production build must never show a real user the bundled "Verified"
// Halifax offer: that is a fabricated credential presented as checked.
describe('walletVc.service in a production build', () => {
  beforeEach(() => { vi.stubEnv('PROD', true); });
  afterEach(() => { vi.unstubAllEnvs(); });

  it('should refuse the SAMPLE credential', async () => {
    await expect(verifyPresented('tx-1', 'SAMPLE')).rejects.toThrow(/not available/);
  });

  it('should refuse to verify anything when no verifier is configured', async () => {
    await expect(verifyPresented('tx-1', 'eyJ.real.jwt')).rejects.toThrow(/not available/);
  });

  it('should refuse the sample presentation request', async () => {
    await expect(getPresentationRequest('tx-1')).rejects.toThrow(/not available/);
  });

  it('should report the tab as unavailable, not demo', () => {
    expect(walletVcMode()).toBe('unavailable');
  });
});
