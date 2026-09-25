import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VaultDocument } from '../../types/vault.types';

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const mockFrom = vi.fn();
const mockGetSession = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => mockFrom(...a),
    auth: { getSession: () => mockGetSession() },
  },
}));

const mockListGrantsForDoc = vi.fn();
const mockRevokeShare = vi.fn();
vi.mock('../documentShare.service', () => ({
  documentShareService: {
    listGrantsForDoc: (...a: unknown[]) => mockListGrantsForDoc(...a),
    revokeShare: (...a: unknown[]) => mockRevokeShare(...a),
  },
}));

const mockRemoveDocument = vi.fn();
vi.mock('../vaultDocument.service', () => ({
  vaultDocumentService: { removeDocument: (...a: unknown[]) => mockRemoveDocument(...a) },
}));

import { transactionWalletService } from '../transactionWallet.service';

function chain(result: { data?: unknown; error?: { message: string } | null }): Record<string, unknown> {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'insert', 'delete', 'single', 'limit', 'in']) {
    b[m] = vi.fn(() => b);
  }
  b.then = (resolve: (v: unknown) => void) => resolve(result);
  return b;
}

const doc: VaultDocument = {
  id: 'row-1',
  slotId: 'proofOfId',
  blockchainId: 7,
  fileHash: 'a'.repeat(64),
  fileSize: 1,
  mimeType: 'application/pdf',
  uploadedAt: '2026-08-18T10:00:00.000Z',
  objectPath: 'wallet/uid-1/proofOfId-aaaaaaaaaaaa.pdf',
  label: 'Passport',
};
const walletRow = {
  id: 'row-1',
  slot_id: 'proofOfId',
  blockchain_id: 7,
  file_hash: 'a'.repeat(64),
  object_path: doc.objectPath,
  file_size: 1,
  mime_type: 'application/pdf',
  created_at: doc.uploadedAt,
  label: 'Passport',
};
const grant = {
  id: 'g1',
  transactionId: 'tx1',
  docHash: doc.fileHash,
  slotId: 'proofOfId',
  objectPath: 'shared/tx1/uid-1/proofOfId-aaaaaaaaaaaa.pdf',
  granteePrincipal: 'p-1',
  status: 'active' as const,
  createdAt: '2026-08-18T11:00:00Z',
  revokedAt: null,
  expiresAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockReset();
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'uid-1' } } } });
  mockRevokeShare.mockResolvedValue({ auditLogged: true });
});

describe('transactionWalletService.listSent', () => {
  it('should return the wallet documents sent to a deal, newest sent first', async () => {
    mockFrom.mockReturnValueOnce(
      chain({ data: [{ id: 'item-1', sent_at: '2026-08-18T12:00:00Z', wallet_documents: walletRow }], error: null }),
    );
    const sent = await transactionWalletService.listSent('tx1');
    expect(mockFrom).toHaveBeenCalledWith('transaction_wallet_items');
    expect(sent).toEqual([{ itemId: 'item-1', sentAt: '2026-08-18T12:00:00Z', doc }]);
  });
});

describe('transactionWalletService.send', () => {
  it('should insert an item row for the signed-in user', async () => {
    const insertSpy = vi.fn(() => chain({ data: { id: 'item-1', sent_at: '2026-08-18T12:00:00Z' }, error: null }));
    mockFrom.mockReturnValueOnce({ insert: insertSpy });
    const item = await transactionWalletService.send('tx1', doc);
    expect(insertSpy).toHaveBeenCalledWith({ transaction_id: 'tx1', user_id: 'uid-1', wallet_document_id: 'row-1' });
    expect(item).toEqual({ itemId: 'item-1', sentAt: '2026-08-18T12:00:00Z', doc });
  });

  it('should treat a duplicate send as already sent (no throw)', async () => {
    const insertSpy = vi.fn(() => chain({ data: null, error: { message: 'duplicate key value violates unique constraint' } }));
    mockFrom
      .mockReturnValueOnce({ insert: insertSpy })
      .mockReturnValueOnce(chain({ data: { id: 'item-1', sent_at: '2026-08-18T12:00:00Z' }, error: null }));
    const item = await transactionWalletService.send('tx1', doc);
    expect(item.itemId).toBe('item-1');
  });
});

describe('transactionWalletService.unsend', () => {
  it('should revoke every active grant for the doc in that deal, then delete the item', async () => {
    mockListGrantsForDoc.mockResolvedValue([grant]);
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }));
    const result = await transactionWalletService.unsend('tx1', doc);
    expect(mockListGrantsForDoc).toHaveBeenCalledWith(doc.fileHash, 'tx1');
    expect(mockRevokeShare).toHaveBeenCalledWith(grant);
    expect(mockFrom).toHaveBeenCalledWith('transaction_wallet_items');
    expect(result).toEqual({ revoked: 1 });
  });
});

describe('transactionWalletService.listDealsFor / removeFromWalletEverywhere', () => {
  it('should list the deals a wallet doc has been sent to', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: [{ transaction_id: 'tx1' }, { transaction_id: 'tx2' }], error: null }));
    await expect(transactionWalletService.listDealsFor(doc)).resolves.toEqual(['tx1', 'tx2']);
  });

  it('should revoke all active grants across deals, then remove the wallet doc (items cascade in DB)', async () => {
    mockListGrantsForDoc.mockResolvedValue([grant, { ...grant, id: 'g2', transactionId: 'tx2' }]);
    mockRemoveDocument.mockResolvedValue(undefined);
    const result = await transactionWalletService.removeFromWalletEverywhere(doc);
    expect(mockListGrantsForDoc).toHaveBeenCalledWith(doc.fileHash);
    expect(mockRevokeShare).toHaveBeenCalledTimes(2);
    expect(mockRemoveDocument).toHaveBeenCalledWith(doc);
    expect(result).toEqual({ revoked: 2 });
  });

  it('should still remove the wallet doc when a revoke throws, reporting how many were revoked', async () => {
    mockListGrantsForDoc.mockResolvedValue([grant, { ...grant, id: 'g2' }]);
    mockRevokeShare.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ auditLogged: true });
    mockRemoveDocument.mockResolvedValue(undefined);
    const result = await transactionWalletService.removeFromWalletEverywhere(doc);
    expect(result).toEqual({ revoked: 1 });
    expect(mockRemoveDocument).toHaveBeenCalled();
  });
});
