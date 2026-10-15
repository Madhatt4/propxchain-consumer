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

  it('should send no extracted data on-chain, not even a hash', async () => {
    // Arrange
    const extracted = { fullName: 'Jane Doe', passportNumber: '123456789' };

    // Act
    const result = await oscarDocumentAnalysis.registerVerificationOnChain(
      12,
      analysisWith(extracted),
      'passport'
    );

    // Assert
    expect(result).toEqual({ success: true, verificationId: 7 });
    expect(sentInput().extractedData).toBe('');
  });

  it('should not put any personal value anywhere in the on-chain payload', async () => {
    const extracted = {
      fullName: 'Jane Doe',
      dateOfBirth: '1980-01-01',
      address: '1 High Street, Sandy'
    };
    const analysis = {
      ...analysisWith(extracted),
      issues: [
        { severity: 'error', code: 'NAME_MISMATCH', message: 'Name Jane Doe does not match', field: 'fullName' }
      ],
      mismatches: [{ field: 'dateOfBirth', expected: '1980-01-01', found: '1981-02-02' }]
    } as OscarAnalysisResult;

    await oscarDocumentAnalysis.registerVerificationOnChain(3, analysis, 'passport');

    // confidence is a bigint, which JSON.stringify cannot encode by default.
    const payload = JSON.stringify(sentInput(), (_key, v: unknown) =>
      typeof v === 'bigint' ? v.toString() : v
    );
    for (const value of [...Object.values(extracted), '1981-02-02', 'Jane Doe']) {
      expect(payload).not.toContain(value);
    }
    // The shape survives: field names and codes, never the values.
    expect(payload).toContain('NAME_MISMATCH');
    expect(payload).toContain('dateOfBirth');
  });

  it('should return the canister error when verifyWithOscar rejects the record', async () => {
    verifyWithOscar.mockResolvedValue({ err: 'Unauthorized' });

    const result = await oscarDocumentAnalysis.registerVerificationOnChain(
      3,
      analysisWith({ fullName: 'Jane Doe' }),
      'passport'
    );

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
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
