// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { oscarDocumentAnalysis } from '../oscarDocumentAnalysis.service';

import type { OscarAnalysisResult } from '../../../types/oscar.types';

const { verifyWithOscar, actorHolder } = vi.hoisted(() => {
  const verifyWithOscar = vi.fn();
  return {
    verifyWithOscar,
    actorHolder: { actor: { verifyWithOscar } as Record<string, unknown> | null }
  };
});

vi.mock('../../icp.service', () => ({
  icpService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    get documentVerificationActor() {
      return actorHolder.actor;
    }
  }
}));

vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }));

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../../stores/authStore', () => ({
  getStorePrincipalId: vi.fn().mockReturnValue('test-principal')
}));

interface SentOscarInput {
  extractedData: string;
}

function analysisWith(extractedData: Record<string, unknown>): OscarAnalysisResult {
  return {
    verified: false,
    confidence: 72.4,
    issues: [],
    extractedData,
    mismatches: [],
    recommendations: [],
    requiresSolicitorReview: true,
    analysisTimestamp: '2026-10-15T00:00:00.000Z'
  };
}

function sentInput(): SentOscarInput {
  const call = verifyWithOscar.mock.calls[0] as [bigint, SentOscarInput];
  return call[1];
}

describe('oscarDocumentAnalysis.registerVerificationOnChain', () => {
  beforeEach(() => {
    verifyWithOscar.mockReset();
    verifyWithOscar.mockResolvedValue({ ok: { id: 7n } });
    actorHolder.actor = { verifyWithOscar };
  });

  it('should send a SHA-256 digest of extractedData, never the plaintext', async () => {
    // Arrange: compact JSON of these fields hashes to the digest below.
    const extracted = { fullName: 'Jane Doe', passportNumber: '123456789' };

    // Act
    const result = await oscarDocumentAnalysis.registerVerificationOnChain(
      12,
      analysisWith(extracted),
      'passport'
    );

    // Assert
    expect(result).toEqual({ success: true, verificationId: 7 });
    const sent = sentInput().extractedData;
    expect(sent).toBe(
      'fbe630e0be48124fda1ae8c55a9af330fed042b11606a0ce9a81b8eaa5454d4e'
    );
    expect(sent).not.toContain('Jane Doe');
    expect(sent).not.toContain('123456789');
  });

  it('should send a 64-char lowercase hex digest when extractedData is empty', async () => {
    await oscarDocumentAnalysis.registerVerificationOnChain(
      12,
      analysisWith({}),
      'passport'
    );

    expect(sentInput().extractedData).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should not put any personal value anywhere in the on-chain payload', async () => {
    const extracted = {
      fullName: 'Jane Doe',
      dateOfBirth: '1980-01-01',
      address: '1 High Street, Sandy'
    };

    await oscarDocumentAnalysis.registerVerificationOnChain(
      3,
      analysisWith(extracted),
      'passport'
    );

    // confidence is a bigint, which JSON.stringify cannot encode by default.
    const payload = JSON.stringify(sentInput(), (_key, v: unknown) =>
      typeof v === 'bigint' ? v.toString() : v
    );
    for (const value of Object.values(extracted)) {
      expect(payload).not.toContain(value);
    }
  });

  it('should report failure without calling the canister when the actor is missing', async () => {
    actorHolder.actor = null;

    const result = await oscarDocumentAnalysis.registerVerificationOnChain(
      3,
      analysisWith({ fullName: 'Jane Doe' }),
      'passport'
    );

    expect(result).toEqual({
      success: false,
      error: 'Document verification actor not initialized'
    });
    expect(verifyWithOscar).not.toHaveBeenCalled();
  });
});
