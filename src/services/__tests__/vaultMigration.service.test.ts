import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const getAllRecords = vi.fn();
const removeRecord = vi.fn();
vi.mock('../localDocumentRegistry', () => ({
  localDocumentRegistry: {
    getAllRecords: () => getAllRecords(),
    removeDocument: (...a: unknown[]) => removeRecord(...a),
  },
}));

const getFile = vi.fn();
const deleteFile = vi.fn();
vi.mock('../vaultFileStore', () => ({
  vaultFileStore: {
    getFile: (...a: unknown[]) => getFile(...a),
    deleteFile: (...a: unknown[]) => deleteFile(...a),
  },
}));

const importAnchored = vi.fn();
vi.mock('../vaultDocument.service', () => ({
  vaultDocumentService: { importAnchored: (...a: unknown[]) => importAnchored(...a) },
}));

import { vaultMigrationService } from '../vaultMigration.service';

const rec = {
  id: 'l1',
  uploadedBy: 'p1',
  documentType: 'proofOfId',
  fileHash: 'a'.repeat(64),
  blockchainId: 5,
  mimeType: 'application/pdf',
  fileSize: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
  removeRecord.mockResolvedValue({ success: true });
  deleteFile.mockResolvedValue(undefined);
});

describe('vaultMigrationService.listLegacy', () => {
  it("should list only this principal's wallet-slot records", async () => {
    getAllRecords.mockResolvedValue([
      rec,
      { ...rec, id: 'l2', uploadedBy: 'other' },
      { ...rec, id: 'l3', documentType: 'ta6' },
    ]);
    const legacy = await vaultMigrationService.listLegacy('p1');
    expect(legacy.map((d) => d.localId)).toEqual(['l1']);
    expect(legacy[0]).toMatchObject({ slotId: 'proofOfId', blockchainId: 5, fileHash: 'a'.repeat(64) });
  });

  it('should return an empty list when the local registry is unavailable', async () => {
    getAllRecords.mockRejectedValue(new Error('no indexeddb'));
    await expect(vaultMigrationService.listLegacy('p1')).resolves.toEqual([]);
  });
});

describe('vaultMigrationService.migrateAll', () => {
  it('should upload each local file via importAnchored then delete the local copy', async () => {
    getAllRecords.mockResolvedValue([rec]);
    getFile.mockResolvedValue({ blob: new Blob(['x']), fileName: 'p.pdf' });
    importAnchored.mockResolvedValue({ id: 'row-1', slotId: 'proofOfId' });
    const seen: unknown[] = [];

    const result = await vaultMigrationService.migrateAll('p1', (d) => seen.push(d));

    expect(importAnchored).toHaveBeenCalledWith(
      expect.objectContaining({ slotId: 'proofOfId', fileHash: 'a'.repeat(64), blockchainId: 5, fileSize: 3 }),
    );
    expect(deleteFile).toHaveBeenCalledWith('l1');
    expect(removeRecord).toHaveBeenCalledWith('l1');
    expect(result).toEqual({ moved: 1, failed: 0 });
    expect(seen).toHaveLength(1);
  });

  it('should count a missing local blob as failed and keep going', async () => {
    getAllRecords.mockResolvedValue([rec, { ...rec, id: 'l2', fileHash: 'b'.repeat(64) }]);
    getFile
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ blob: new Blob(['y']), fileName: 'q.pdf' });
    importAnchored.mockResolvedValue({ id: 'row-2', slotId: 'proofOfId' });

    const result = await vaultMigrationService.migrateAll('p1');

    expect(result).toEqual({ moved: 1, failed: 1 });
    expect(removeRecord).not.toHaveBeenCalledWith('l1'); // never delete what we didn't move
    expect(removeRecord).toHaveBeenCalledWith('l2');
  });

  it('should leave the local copy in place when the upload fails', async () => {
    getAllRecords.mockResolvedValue([rec]);
    getFile.mockResolvedValue({ blob: new Blob(['x']), fileName: 'p.pdf' });
    importAnchored.mockRejectedValue(new Error('network'));

    const result = await vaultMigrationService.migrateAll('p1');

    expect(result).toEqual({ moved: 0, failed: 1 });
    expect(deleteFile).not.toHaveBeenCalled();
    expect(removeRecord).not.toHaveBeenCalled();
  });
});
