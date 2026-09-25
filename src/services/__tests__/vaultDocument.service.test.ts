import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VaultDocument } from '../../types/vault.types';

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../utils/hashGenerator', () => ({
  generateFileHash: vi.fn().mockResolvedValue('a'.repeat(64)),
}));

const registerDocumentProof = vi.fn();
vi.mock('../icp.service', () => ({
  icpService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    ensureDocumentStorageActor: vi.fn().mockResolvedValue(undefined),
    getDocumentStorageCsrfToken: vi.fn().mockResolvedValue('csrf-token'),
    documentStorageActor: {
      registerDocumentProof: (...a: unknown[]) => registerDocumentProof(...a),
    },
  },
}));

const mockFrom = vi.fn();
const mockUpload = vi.fn();
const mockDownload = vi.fn();
const mockRemove = vi.fn();
const mockGetSession = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => mockFrom(...a),
    storage: {
      from: () => ({ upload: mockUpload, download: mockDownload, remove: mockRemove }),
    },
    auth: { getSession: () => mockGetSession() },
  },
}));

import { vaultDocumentService, validateVaultFile } from '../vaultDocument.service';
import { VAULT_SLOTS } from '../../types/vault.types';

/** Chainable thenable query builder resolving to `result`. */
function chain(result: {
  data?: unknown;
  error?: { message: string } | null;
}): Record<string, unknown> {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'insert', 'delete', 'single', 'limit']) {
    b[m] = vi.fn(() => b);
  }
  b.then = (resolve: (v: unknown) => void) => resolve(result);
  return b;
}

const idSlot = VAULT_SLOTS.find((s) => s.id === 'proofOfId')!;
const file = new File(['x'], 'my-passport.pdf', { type: 'application/pdf' });
const row = {
  id: 'row-1',
  slot_id: 'proofOfId',
  blockchain_id: 7,
  file_hash: 'a'.repeat(64),
  object_path: 'wallet/uid-1/proofOfId-aaaaaaaaaaaa.pdf',
  file_size: 1,
  mime_type: 'application/pdf',
  created_at: '2026-08-18T10:00:00.000Z',
};
const caps = { maxFilesPerSlot: 10, maxTotalBytes: 1000 };
const labelledRow = { ...row, label: 'Barclays statement March' };

function docFromRow(): VaultDocument {
  return {
    id: row.id,
    slotId: 'proofOfId',
    blockchainId: 7,
    fileHash: row.file_hash,
    fileSize: 1,
    mimeType: row.mime_type,
    uploadedAt: row.created_at,
    objectPath: row.object_path,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockReset();
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'uid-1' } } } });
  registerDocumentProof.mockResolvedValue({ ok: BigInt(7) });
  mockUpload.mockResolvedValue({ error: null });
  mockRemove.mockResolvedValue({ error: null });
});

describe('vaultDocumentService.storeDocument', () => {
  it('should anchor on-chain with the generic label, then upload under wallet/<uid>/ and insert a row', async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: [], error: null })) // usage rows
      .mockReturnValueOnce(chain({ data: row, error: null })); // insert().select().single()

    const doc = await vaultDocumentService.storeDocument(file, idSlot, caps);

    const args = registerDocumentProof.mock.calls[0];
    expect(args[0]).toBe('Proof of Identity'); // generic label, never the filename
    expect(args[1]).toBe('a'.repeat(64));
    expect(args[4]).toBe('wallet');
    expect(args[5]).toEqual([]); // principal-scoped
    expect(args[6]).toBe('proofOfId');
    expect(mockUpload).toHaveBeenCalledWith(
      'wallet/uid-1/proofOfId-aaaaaaaaaaaa.pdf',
      file,
      { contentType: 'application/pdf', upsert: false },
    );
    expect(doc).toEqual(docFromRow());
    expect(doc).not.toHaveProperty('fileName');
  });

  it('should trim and store an optional label, never sending it on-chain', async () => {
    const insertSpy = vi.fn(() => chain({ data: labelledRow, error: null }));
    mockFrom
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce({ insert: insertSpy });

    const doc = await vaultDocumentService.storeDocument(file, idSlot, caps, '  Barclays statement March ');

    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ label: 'Barclays statement March' }));
    expect(doc.label).toBe('Barclays statement March');
    expect(registerDocumentProof.mock.calls[0].some((a) => String(a).includes('Barclays'))).toBe(false);
  });

  it('should store a null label when the label is blank', async () => {
    const insertSpy = vi.fn(() => chain({ data: row, error: null }));
    mockFrom
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce({ insert: insertSpy });
    const doc = await vaultDocumentService.storeDocument(file, idSlot, caps, '   ');
    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({ label: null }));
    expect(doc.label).toBeUndefined();
  });

  it('should refuse when the slot is at its file cap', async () => {
    mockFrom.mockReturnValueOnce(
      chain({
        data: [
          { slot_id: 'proofOfId', file_size: 1 },
          { slot_id: 'proofOfId', file_size: 1 },
        ],
        error: null,
      }),
    );
    await expect(
      vaultDocumentService.storeDocument(file, idSlot, { maxFilesPerSlot: 2, maxTotalBytes: 1000 }),
    ).rejects.toThrow(/maximum of 2 files/);
    expect(registerDocumentProof).not.toHaveBeenCalled();
  });

  it('should refuse when the per-user byte cap would be exceeded', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: [{ slot_id: 'custom1', file_size: 1000 }], error: null }));
    await expect(vaultDocumentService.storeDocument(file, idSlot, caps)).rejects.toThrow(/storage limit/);
    expect(registerDocumentProof).not.toHaveBeenCalled();
  });

  it('should not upload when the on-chain anchor fails', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null }));
    registerDocumentProof.mockResolvedValue({ err: 'nope' });
    await expect(vaultDocumentService.storeDocument(file, idSlot, caps)).rejects.toThrow(/anchor/);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('should remove the uploaded object when the row insert fails', async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: null, error: { message: 'boom' } }));
    await expect(vaultDocumentService.storeDocument(file, idSlot, caps)).rejects.toThrow(/boom/);
    expect(mockRemove).toHaveBeenCalledWith(['wallet/uid-1/proofOfId-aaaaaaaaaaaa.pdf']);
  });

  it('should require a signed-in Supabase session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    await expect(vaultDocumentService.storeDocument(file, idSlot, caps)).rejects.toThrow(/sign in/i);
  });

  it('should reject an unacceptable file before touching anything', async () => {
    const bad = new File(['x'], 'a.txt', { type: 'text/plain' });
    await expect(vaultDocumentService.storeDocument(bad, idSlot, caps)).rejects.toThrow(/PDF, JPG, or PNG/);
    expect(mockGetSession).not.toHaveBeenCalled();
  });
});

describe('vaultDocumentService reads/removes', () => {
  it('should list the current user documents without filenames', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: [row], error: null }));
    const docs = await vaultDocumentService.listMyDocuments();
    expect(docs).toEqual([docFromRow()]);
    expect(docs[0]).not.toHaveProperty('fileName');
  });

  it('should download the object for getFile', async () => {
    const blob = new Blob(['x']);
    mockDownload.mockResolvedValue({ data: blob, error: null });
    await expect(vaultDocumentService.getFile(docFromRow())).resolves.toBe(blob);
    expect(mockDownload).toHaveBeenCalledWith(row.object_path);
  });

  it('should throw a user-facing error when the download fails', async () => {
    mockDownload.mockResolvedValue({ data: null, error: { message: 'gone' } });
    await expect(vaultDocumentService.getFile(docFromRow())).rejects.toThrow(/could not be retrieved/);
  });

  it('should delete the row then the object on remove', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }));
    await vaultDocumentService.removeDocument(docFromRow());
    expect(mockRemove).toHaveBeenCalledWith([row.object_path]);
  });

  it('should update a label via setLabel and return the trimmed value', async () => {
    const eqSpy = vi.fn(() => chain({ data: null, error: null }));
    const updateSpy = vi.fn(() => ({ eq: eqSpy }));
    mockFrom.mockReturnValueOnce({ update: updateSpy });
    await expect(vaultDocumentService.setLabel(docFromRow(), ' Title deed ')).resolves.toBe('Title deed');
    expect(updateSpy).toHaveBeenCalledWith({ label: 'Title deed' });
    expect(eqSpy).toHaveBeenCalledWith('id', 'row-1');
  });

  it('should sum usage bytes', async () => {
    mockFrom.mockReturnValueOnce(
      chain({ data: [{ slot_id: 'a', file_size: 3 }, { slot_id: 'b', file_size: 4 }], error: null }),
    );
    await expect(vaultDocumentService.getUsageBytes()).resolves.toBe(7);
  });
});

describe('vaultDocumentService.importAnchored', () => {
  it('should upload + insert without calling the canister', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: row, error: null }));
    const doc = await vaultDocumentService.importAnchored({
      blob: new Blob(['x']),
      slotId: 'proofOfId',
      fileHash: 'a'.repeat(64),
      blockchainId: 7,
      mimeType: 'application/pdf',
      fileSize: 1,
    });
    expect(registerDocumentProof).not.toHaveBeenCalled();
    expect(mockUpload).toHaveBeenCalledWith(
      'wallet/uid-1/proofOfId-aaaaaaaaaaaa.pdf',
      expect.any(Blob),
      { contentType: 'application/pdf', upsert: false },
    );
    expect(doc.id).toBe('row-1');
  });
});

describe('custom slot names', () => {
  it('should round-trip a custom slot name through localStorage and clear on blank', () => {
    vaultDocumentService.setCustomSlotName('p1', 'custom1', '  Gift letter ');
    expect(vaultDocumentService.getCustomSlotName('p1', 'custom1')).toBe('Gift letter');
    vaultDocumentService.setCustomSlotName('p1', 'custom1', '   ');
    expect(vaultDocumentService.getCustomSlotName('p1', 'custom1')).toBeNull();
  });
});

describe('validateVaultFile', () => {
  it('should reject non-PDF/JPG/PNG', () => {
    expect(validateVaultFile(new File(['x'], 'a.txt', { type: 'text/plain' }))).toMatch(/PDF, JPG, or PNG/);
  });
  it('should accept a small PDF', () => {
    expect(validateVaultFile(file)).toBeNull();
  });
});
