import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../utils/hashGenerator', () => ({
  generateFileHash: vi.fn().mockResolvedValue('a'.repeat(64)),
}));

vi.mock('../../constants/documentTypes', () => ({
  getBackendDocumentName: vi.fn().mockReturnValue('Mortgage Agreement'),
}));

const getSession = vi.fn();
const storageUpload = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => getSession() },
    storage: { from: () => ({ upload: storageUpload }) },
  },
}));

const registerDocumentProof = vi.fn();
const registerDocument = vi.fn();
const updateMemberDocuments = vi.fn();
const emitDocumentUploadedEvent = vi.fn();
const ensureDocumentStorageActor = vi.fn();
vi.mock('../icp.service', () => ({
  icpService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    ensureDocumentStorageActor: () => ensureDocumentStorageActor(),
    getDocumentStorageCsrfToken: vi.fn().mockResolvedValue('csrf-token'),
    documentStorageActor: { registerDocumentProof: (...a: unknown[]) => registerDocumentProof(...a) },
    documentVerificationActor: { registerDocument: (...a: unknown[]) => registerDocument(...a) },
    // The service reaches actors through the require* accessors now: the plain
    // getters stay nullable (callers use them as an is-it-up check), so they
    // cannot be narrowed after an await.
    requireDocumentStorage: vi.fn().mockResolvedValue({
      registerDocumentProof: (...a: unknown[]) => registerDocumentProof(...a),
    }),
    requireDocumentVerification: vi.fn().mockResolvedValue({
      registerDocument: (...a: unknown[]) => registerDocument(...a),
    }),
    // Now routed through the icpService wrapper (which stringifies the id and
    // attaches the CSRF token) rather than the raw user_management actor.
    updateMemberDocuments: (...a: unknown[]) => updateMemberDocuments(...a),
    emitDocumentUploadedEvent: (...a: unknown[]) => emitDocumentUploadedEvent(...a),
  },
}));

import { fundingDocumentService } from '../fundingDocument.service';

const file = new File(['x'], 'aip.pdf', { type: 'application/pdf' });
const OPTS = { transactionId: 'tx_5', documentType: 'mortgageAgreement' };

describe('fundingDocumentService.uploadFundingDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ data: { session: { access_token: 'jwt' } }, error: null });
    storageUpload.mockResolvedValue({ error: null });
    registerDocumentProof.mockResolvedValue({ ok: BigInt(11) });
    registerDocument.mockResolvedValue(BigInt(22));
    updateMemberDocuments.mockResolvedValue(true);
  });

  it('stores the file off-chain (supabase://) and anchors the hash on-chain', async () => {
    const record = await fundingDocumentService.uploadFundingDocument(file, OPTS);

    // Off-chain: uploaded to Supabase, location is a supabase:// URL.
    expect(storageUpload).toHaveBeenCalledOnce();
    expect(record.storageLocation).toMatch(/^supabase:\/\/propxchain-documents\/transactions\/tx_5\/funding\//);

    // On-chain proof carries the supabase location (NOT the file bytes).
    const proofArgs = registerDocumentProof.mock.calls[0];
    expect(proofArgs[1]).toBe('a'.repeat(64)); // fileHash
    expect(proofArgs[4]).toBe(record.storageLocation); // storageLocation

    // Verification record: tx id has the "tx_" prefix stripped to a Nat.
    const verifyArgs = registerDocument.mock.calls[0];
    expect(verifyArgs[1]).toEqual([BigInt(5)]);

    expect(record.storageDocId).toBe(11);
    expect(record.verificationDocId).toBe(22);
    expect(emitDocumentUploadedEvent).toHaveBeenCalledOnce();
  });

  it('throws a sign-in message when there is no Supabase session', async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(fundingDocumentService.uploadFundingDocument(file, OPTS)).rejects.toThrow(/sign in/i);
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it('throws when the Supabase upload fails', async () => {
    storageUpload.mockResolvedValue({ error: { message: 'bucket missing' } });
    await expect(fundingDocumentService.uploadFundingDocument(file, OPTS)).rejects.toThrow(/Secure upload failed/);
    expect(registerDocumentProof).not.toHaveBeenCalled();
  });

  it('surfaces a 0 return from registerDocument as an access-denied error', async () => {
    registerDocument.mockResolvedValue(BigInt(0));
    await expect(fundingDocumentService.uploadFundingDocument(file, OPTS)).rejects.toThrow(/Access denied/);
  });

  it('does not fail the upload when the best-effort progress update throws', async () => {
    updateMemberDocuments.mockRejectedValue(new Error('progress down'));
    const record = await fundingDocumentService.uploadFundingDocument(file, OPTS);
    expect(record.verificationDocId).toBe(22);
  });
});
