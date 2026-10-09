// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The stage card's "Upload completed form" path: bytes to the bucket, ask
 * doc-classify what arrived, and refuse a file that is confidently not the
 * form it was handed as. Every dependency is mocked; nothing reaches storage,
 * a canister or Jev.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUpload = vi.fn();
const mockRemove = vi.fn();
const mockGetSession = vi.fn();
const mockRegisterProof = vi.fn();
const mockClassify = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => mockUpload(...args),
        remove: (...args: unknown[]) => mockRemove(...args),
      }),
    },
  },
}));

vi.mock('../icp.service', () => ({
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

vi.mock('../../utils/hashGenerator', () => ({
  generateFileHash: async () => 'abcdef123456deadbeef',
}));

vi.mock('../docClassify.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../docClassify.service')>();
  return { ...actual, classifyDocument: (...args: unknown[]) => mockClassify(...args) };
});

import {
  CompletedFormRejectedError,
  judgeCompletedForm,
  uploadCompletedForm,
} from '../completedFormUpload.service';
import type { DocClassification } from '../docClassify.service';

const file = new File(['pdf-bytes'], 'my-ta6.pdf', { type: 'application/pdf' });

function classified(docType: string, confidence = 0.95): DocClassification {
  return { docType, confidence, inDate: null, matchesProperty: 0.9, unreadable: false };
}

describe('judgeCompletedForm', () => {
  it('should accept a file that reads as the form it was handed as', () => {
    expect(judgeCompletedForm('ta6', classified('ta6_form'))).toEqual({ verdict: 'accepted', reason: null });
    expect(judgeCompletedForm('ta10', classified('ta10_form'))).toEqual({ verdict: 'accepted', reason: null });
    expect(judgeCompletedForm('ta7', classified('ta7_form'))).toEqual({ verdict: 'accepted', reason: null });
  });

  it('should reject a file that confidently reads as something else', () => {
    expect(judgeCompletedForm('ta6', classified('epc'))).toEqual({
      verdict: 'rejected',
      reason: 'This reads as an Energy Performance Certificate, not a completed TA6 form.',
    });
  });

  it('should reject a file that confidently reads as a different form', () => {
    expect(judgeCompletedForm('ta6', classified('ta10_form'))).toEqual({
      verdict: 'rejected',
      reason: 'This reads as a completed TA10 form, not a completed TA6 form.',
    });
  });

  it('should reject a file that confidently reads as none of the kinds we know', () => {
    expect(judgeCompletedForm('ta6', classified('other', 1)).verdict).toBe('rejected');
  });

  it('should let a file through unverified when the classifier is not sure', () => {
    expect(judgeCompletedForm('ta6', classified('epc', 0.4))).toEqual({
      verdict: 'unverified',
      reason: "We couldn't confirm what this document is.",
    });
  });

  it('should let a file through unverified when its text could not be read', () => {
    expect(judgeCompletedForm('ta6', { ...classified('other', 0), unreadable: true })).toEqual({
      verdict: 'unverified',
      reason: "We couldn't read the text in this file.",
    });
  });

  it('should let a file through unverified when the classifier is unavailable', () => {
    expect(judgeCompletedForm('ta6', null)).toEqual({
      verdict: 'unverified',
      reason: "We couldn't check this file right now.",
    });
  });
});

describe('uploadCompletedForm', () => {
  beforeEach(() => {
    mockUpload.mockReset().mockResolvedValue({ error: null });
    mockRemove.mockReset().mockResolvedValue({ error: null });
    mockGetSession.mockReset().mockResolvedValue({ data: { session: { access_token: 't' } }, error: null });
    mockRegisterProof.mockReset().mockResolvedValue({ ok: 7n });
    mockClassify.mockReset().mockResolvedValue(classified('ta6_form'));
  });

  it('should upload under the form folder, classify that object, and register the proof when accepted', async () => {
    const result = await uploadCompletedForm(file, 'tx_1', 'ta6');

    expect(mockUpload).toHaveBeenCalledWith('transactions/tx_1/ta6/abcdef123456.pdf', file, expect.anything());
    expect(mockClassify).toHaveBeenCalledWith('tx_1', 'transactions/tx_1/ta6/abcdef123456.pdf');
    expect(mockRegisterProof).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ documentId: '7', verdict: 'accepted', reason: null });
  });

  it('should keep each form in its own folder', async () => {
    mockClassify.mockResolvedValue(classified('ta10_form'));

    await uploadCompletedForm(file, 'tx_1', 'ta10');

    expect(mockUpload).toHaveBeenCalledWith('transactions/tx_1/ta10/abcdef123456.pdf', file, expect.anything());
  });

  it('should remove the object and throw, registering nothing, when the file is rejected', async () => {
    mockClassify.mockResolvedValue(classified('epc'));

    await expect(uploadCompletedForm(file, 'tx_1', 'ta6')).rejects.toThrow(CompletedFormRejectedError);
    expect(mockRemove).toHaveBeenCalledWith(['transactions/tx_1/ta6/abcdef123456.pdf']);
    expect(mockRegisterProof).not.toHaveBeenCalled();
  });

  it('should say why in the rejection', async () => {
    mockClassify.mockResolvedValue(classified('epc'));

    await expect(uploadCompletedForm(file, 'tx_1', 'ta6')).rejects.toThrow(
      'This reads as an Energy Performance Certificate, not a completed TA6 form.',
    );
  });

  it('should register an unverified file and carry the reason back for the caller to show', async () => {
    mockClassify.mockResolvedValue(null);

    const result = await uploadCompletedForm(file, 'tx_1', 'ta6');

    expect(mockRegisterProof).toHaveBeenCalledTimes(1);
    expect(mockRemove).not.toHaveBeenCalled();
    expect(result).toEqual({ documentId: '7', verdict: 'unverified', reason: "We couldn't check this file right now." });
  });
});
