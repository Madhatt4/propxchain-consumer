import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Records each call's config, so the shared-call keys can be checked.
const readConfigs: Array<{ cacheKey?: string } | undefined> = [];
vi.mock('../canisterRateLimiter', () => ({
  wrapWriteCall: async <T,>(fn: () => Promise<T>): Promise<T> => fn(),
  wrapReadCall: async <T,>(fn: () => Promise<T>, config?: { cacheKey?: string }): Promise<T> => {
    readConfigs.push(config);
    return fn();
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { icpService } from '../icp.service';

type Internals = {
  _documentStorageActor: Record<string, ReturnType<typeof vi.fn>> | null;
};

const internals = icpService as unknown as Internals;

const proof = {
  id: 7n,
  docType: 'titleDeeds',
  fileName: 'title.pdf',
  fileHash: 'ab',
  fileSize: 10n,
  contentType: 'application/pdf',
  uploadedBy: { toString: (): string => 'seller-1' },
  uploadedAt: 1_793_000_000_123_456_789n,
  storageLocation: 'onchain',
  verified: false,
  transactionId: ['tx_1'],
};

describe('icpService document reads', () => {
  const actor = {
    fetchTransactionDocuments: vi.fn(),
    fetchTransactionDocumentStatus: vi.fn(),
    fetchAuditLogs: vi.fn(),
    fetchDocumentMetadata: vi.fn(),
  };

  beforeEach(() => {
    Object.values(actor).forEach((fn) => fn.mockReset());
    readConfigs.length = 0;
    vi.spyOn(icpService, 'ensureDocumentStorageActor').mockResolvedValue(undefined);
    internals._documentStorageActor = actor;
  });

  afterEach(() => {
    internals._documentStorageActor = null;
    vi.restoreAllMocks();
  });

  it('should read a transaction through the party-gated call and keep the exact timestamp', async () => {
    // Arrange
    actor.fetchTransactionDocuments.mockResolvedValue([proof]);

    // Act
    const [row] = await icpService.getDocumentsByTransaction('tx_1');

    // Assert
    expect(actor.fetchTransactionDocuments).toHaveBeenCalledWith('tx_1');
    expect(row).toMatchObject({ id: 'doc_7', type: 'titleDeeds', uploadedAtNs: '1793000000123456789' });
  });

  it('should send a numeric transaction id as text', async () => {
    actor.fetchTransactionDocuments.mockResolvedValue([]);

    await icpService.getDocumentsByTransaction(12);

    expect(actor.fetchTransactionDocuments).toHaveBeenCalledWith('12');
  });

  it('should throw rather than return an empty list when the read fails', async () => {
    actor.fetchTransactionDocuments.mockRejectedValue(new Error('update rejected'));

    await expect(icpService.getDocumentsByTransaction('tx_1')).rejects.toThrow('update rejected');
    await expect(icpService.fetchTransactionDocuments('tx_1')).rejects.toThrow('update rejected');
  });

  it('should share one key per deal so concurrent views make one update call', async () => {
    actor.fetchTransactionDocuments.mockResolvedValue([]);

    await icpService.getDocumentsByTransaction('tx_1');
    await icpService.fetchTransactionDocuments('tx_1');
    await icpService.fetchTransactionDocuments('tx_2');

    expect(readConfigs.map((config) => config?.cacheKey)).toEqual([
      'fetchTransactionDocuments:tx_1',
      'fetchTransactionDocuments:tx_1',
      'fetchTransactionDocuments:tx_2',
    ]);
  });

  it('should return status rows with the timestamp as an exact string', async () => {
    actor.fetchTransactionDocumentStatus.mockResolvedValue([
      { category: 'funds', verified: true, uploadedAt: 1_793_000_000_123_456_789n },
    ]);

    expect(await icpService.getDocumentStatus('tx_1')).toEqual([
      { category: 'funds', verified: true, uploadedAtNs: '1793000000123456789' },
    ]);
  });

  it('should read audit logs through the party-gated call', async () => {
    actor.fetchAuditLogs.mockResolvedValue([{ id: 1n }]);

    expect(await icpService.fetchDocumentAuditLogs(7)).toEqual([{ id: 1n }]);
    expect(actor.fetchAuditLogs).toHaveBeenCalledWith(7n);
  });

  it('should read metadata through the party-gated call and return null when refused', async () => {
    actor.fetchDocumentMetadata.mockResolvedValue({ err: 'Document not found' });

    expect(await icpService.fetchDocumentMetadata(7)).toBeNull();
    expect(actor.fetchDocumentMetadata).toHaveBeenCalledWith(7n);
  });
});
