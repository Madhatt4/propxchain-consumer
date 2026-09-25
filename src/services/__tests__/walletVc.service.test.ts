// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2025 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPresentationRequest, verifyPresented, type VerifyResult } from '@/services/walletVc.service';

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
