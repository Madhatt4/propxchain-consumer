// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Tests for the TA6 attachment uploader's wiring: bytes to the bucket, proof
 * to the canister, then the advisory classification of what was uploaded.
 * Every dependency is mocked — nothing reaches storage, a canister or Jev.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUpload = vi.fn();
const mockGetSession = vi.fn();
const mockRegisterProof = vi.fn();
const mockClassify = vi.fn();

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
    storage: { from: () => ({ upload: (...args: unknown[]) => mockUpload(...args) }) },
  },
}));

vi.mock('../../../../services/icp.service', () => ({
  icpService: {
    initialize: async () => undefined,
    ensureDocumentStorageActor: async () => undefined,
    getDocumentStorageCsrfToken: async () => 'csrf',
    documentStorageActor: {
      registerDocumentProof: (...args: unknown[]) => mockRegisterProof(...args),
    },
    emitDocumentUploadedEvent: () => undefined,
  },
}));

vi.mock('../../../../utils/hashGenerator', () => ({
  generateFileHash: async () => 'abcdef123456deadbeef',
}));

vi.mock('../../../../services/docClassify.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../services/docClassify.service')>();
  return { ...actual, classifyDocument: (...args: unknown[]) => mockClassify(...args) };
});

import { makeTa6Uploader } from '../widgets/ta6Uploader';

const file = new File(['pdf-bytes'], 'epc.pdf', { type: 'application/pdf' });

describe('makeTa6Uploader', () => {
  beforeEach(() => {
    mockUpload.mockReset().mockResolvedValue({ error: null });
    mockGetSession.mockReset().mockResolvedValue({ data: { session: { access_token: 't' } }, error: null });
    mockRegisterProof.mockReset().mockResolvedValue({ ok: 7n });
    mockClassify.mockReset().mockResolvedValue({
      docType: 'epc',
      confidence: 0.97,
      inDate: true,
      matchesProperty: 0.9,
      unreadable: false,
    });
  });

  it('should return the document id and an advisory line for the upload', async () => {
    const upload = makeTa6Uploader('tx_1');

    const result = await upload(file);

    expect(result.documentId).toBe('7');
    expect(await result.advisory).toBe('Reads as an Energy Performance Certificate.');
  });

  it('should classify the object at the bucket-relative path it uploaded to', async () => {
    const upload = makeTa6Uploader('tx_1');

    await upload(file);

    expect(mockUpload).toHaveBeenCalledWith(
      'transactions/tx_1/ta6/abcdef123456.pdf',
      file,
      expect.anything(),
    );
    expect(mockClassify).toHaveBeenCalledWith('tx_1', 'transactions/tx_1/ta6/abcdef123456.pdf');
  });

  it('should resolve the advisory to null when classification is unavailable', async () => {
    mockClassify.mockResolvedValue(null);
    const upload = makeTa6Uploader('tx_1');

    const result = await upload(file);

    expect(result.documentId).toBe('7');
    expect(await result.advisory).toBeNull();
  });

  it('should still reject the upload when the proof is refused, without classifying', async () => {
    mockRegisterProof.mockResolvedValue({ err: 'nope' });
    const upload = makeTa6Uploader('tx_1');

    await expect(upload(file)).rejects.toThrow('document_storage rejected proof: nope');
    expect(mockClassify).not.toHaveBeenCalled();
  });
});
