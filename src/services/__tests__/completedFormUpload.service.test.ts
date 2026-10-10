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

const mockGetDocuments = vi.fn();
const mockDeleteStorageDocument = vi.fn();
const mockUnrecord = vi.fn();

vi.mock('../icp.service', () => ({
  icpService: {
    initialize: async () => undefined,
    ensureDocumentStorageActor: async () => undefined,
    getDocumentStorageCsrfToken: async () => 'csrf',
    documentStorageActor: {
      registerDocumentProof: (...args: unknown[]) => mockRegisterProof(...args),
    },
    emitDocumentUploadedEvent: () => undefined,
    getDocumentsByTransaction: (...args: unknown[]) => mockGetDocuments(...args),
    deleteStorageDocument: (...args: unknown[]) => mockDeleteStorageDocument(...args),
    unrecordFormUpload: (...args: unknown[]) => mockUnrecord(...args),
  },
}));
vi.mock('../../utils/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

vi.mock('../../utils/hashGenerator', () => ({
  generateFileHash: async () => 'abcdef123456deadbeef',
}));

vi.mock('../docClassify.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../docClassify.service')>();
  return { ...actual, classifyDocument: (...args: unknown[]) => mockClassify(...args) };
});

import {
  withdrawCompletedForm,
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

describe('withdrawCompletedForm', () => {
  const ta6Pdf = { id: 'doc_41', type: 'ta6_canonical_upload', storageLocation: 'supabase://propxchain-documents/transactions/tx_1/ta6/abc.pdf' };
  const ta10Pdf = { id: 'doc_42', type: 'ta10_canonical_upload', storageLocation: 'supabase://propxchain-documents/transactions/tx_1/ta10/def.pdf' };

  beforeEach(() => {
    mockGetDocuments.mockReset().mockResolvedValue([ta6Pdf, ta10Pdf]);
    mockDeleteStorageDocument.mockReset().mockResolvedValue(true);
    mockRemove.mockReset().mockResolvedValue({ error: null });
    mockUnrecord.mockReset().mockResolvedValue(undefined);
  });

  it('should delete only this form\'s PDF proof and bytes, then clear the upload on the transaction', async () => {
    const result = await withdrawCompletedForm('tx_1', 'ta6');

    expect(result).toEqual({ removed: 1 });
    expect(mockDeleteStorageDocument).toHaveBeenCalledTimes(1);
    expect(mockDeleteStorageDocument).toHaveBeenCalledWith(41);
    expect(mockRemove).toHaveBeenCalledWith(['transactions/tx_1/ta6/abc.pdf']);
    expect(mockUnrecord).toHaveBeenCalledWith('tx_1', 'ta6');
  });

  it('should clear the upload even when no PDF proof is on record', async () => {
    mockGetDocuments.mockResolvedValue([]);

    expect(await withdrawCompletedForm('tx_1', 'ta7')).toEqual({ removed: 0 });
    expect(mockDeleteStorageDocument).not.toHaveBeenCalled();
    expect(mockUnrecord).toHaveBeenCalledWith('tx_1', 'ta7');
  });

  it('should stop before clearing the flag when the proof will not delete', async () => {
    mockDeleteStorageDocument.mockResolvedValue(false);

    await expect(withdrawCompletedForm('tx_1', 'ta6')).rejects.toThrow('The stored PDF could not be removed');
    expect(mockUnrecord).not.toHaveBeenCalled();
  });

  it('should still clear the flag when the bucket object is already gone', async () => {
    mockRemove.mockResolvedValue({ error: { message: 'Object not found' } });

    expect(await withdrawCompletedForm('tx_1', 'ta6')).toEqual({ removed: 1 });
    expect(mockUnrecord).toHaveBeenCalledTimes(1);
  });

  it('should surface the canister\'s refusal when the caller may not withdraw', async () => {
    mockUnrecord.mockRejectedValue(new Error('Only the seller or their solicitor can withdraw a form upload'));

    await expect(withdrawCompletedForm('tx_1', 'ta6')).rejects.toThrow(/Only the seller or their solicitor/);
  });
});
