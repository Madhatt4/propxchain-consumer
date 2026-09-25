import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VaultDocument } from '../../types/vault.types';

const mockFrom = vi.fn();
const mockCopy = vi.fn();
const mockRemove = vi.fn();
const mockGetSession = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => mockFrom(...a),
    storage: { from: () => ({ copy: mockCopy, remove: mockRemove }) },
    auth: { getSession: () => mockGetSession() },
  },
}));

const mockRecordDocShared = vi.fn();
const mockRecordDocShareRevoked = vi.fn();
vi.mock('../icp.service', () => ({
  icpService: {
    get transactionManager() {
      return {
        recordDocShared: (...a: unknown[]) => mockRecordDocShared(...a),
        recordDocShareRevoked: (...a: unknown[]) => mockRecordDocShareRevoked(...a),
      };
    },
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { documentShareService } from '../documentShare.service';

/** Chainable thenable supabase query builder that resolves to `result`. */
function chain(result: { data?: unknown; error?: { message: string } | null }): Record<string, unknown> {
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'limit', 'insert', 'update', 'delete', 'single', 'order', 'is', 'lt']) {
    builder[m] = vi.fn(() => builder);
  }
  builder.then = (resolve: (v: unknown) => void) => resolve(result);
  return builder;
}

const doc: VaultDocument = {
  id: 'row-1',
  slotId: 'mortgageOffer',
  blockchainId: 42,
  fileHash: 'a'.repeat(64),
  fileSize: 1000,
  mimeType: 'application/pdf',
  uploadedAt: '2026-07-16T00:00:00Z',
  objectPath: `wallet/uid-1/mortgageOffer-${'a'.repeat(12)}.pdf`,
};

const grantRow = {
  id: 'g1',
  transaction_id: 'tx1',
  doc_hash: doc.fileHash,
  slot_id: 'mortgageOffer',
  object_path: `shared/tx1/uid-1/mortgageOffer-${'a'.repeat(12)}.pdf`,
  grantee_principal: 'conv-principal',
  status: 'active',
  created_at: '2026-07-16T10:00:00Z',
  revoked_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: 'uid-1' }, access_token: 'jwt' } },
    error: null,
  });
  mockCopy.mockResolvedValue({ error: null });
});

describe('documentShareService.shareDocument', () => {
  it('should copy the wallet object to the shared path, insert a grant and log on-chain', async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: [], error: null })) // no existing object
      .mockReturnValueOnce(chain({ data: grantRow, error: null })); // insert
    mockRecordDocShared.mockResolvedValue({ ok: null });

    const grant = await documentShareService.shareDocument(doc, 'tx1', 'conv-principal');

    expect(mockCopy).toHaveBeenCalledWith(
      doc.objectPath,
      `shared/tx1/uid-1/mortgageOffer-${'a'.repeat(12)}.pdf`
    );
    expect(mockRecordDocShared).toHaveBeenCalledWith('tx1', doc.fileHash, 'conv-principal');
    expect(grant.objectPath).toBe(grantRow.object_path);
    expect(grant.status).toBe('active');
  });

  it('should reuse the existing object when another active grant exists (promote-once)', async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: [{ object_path: grantRow.object_path }], error: null }))
      .mockReturnValueOnce(chain({ data: grantRow, error: null }));
    mockRecordDocShared.mockResolvedValue({ ok: null });

    await documentShareService.shareDocument(doc, 'tx1', 'other-principal');

    expect(mockCopy).not.toHaveBeenCalled();
  });

  it('should surface a copy failure and not create a grant', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null })); // no existing object
    mockCopy.mockResolvedValue({ error: { message: 'Object not found' } });

    await expect(
      documentShareService.shareDocument(doc, 'tx1', 'conv-principal')
    ).rejects.toThrow(/no longer in your wallet/);
    expect(mockRecordDocShared).not.toHaveBeenCalled();
  });

  it('should roll back the grant and object when the on-chain log fails', async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: [], error: null })) // no existing object
      .mockReturnValueOnce(chain({ data: grantRow, error: null })) // insert
      .mockReturnValueOnce(chain({ data: null, error: null })) // rollback delete
      .mockReturnValueOnce(chain({ data: [], error: null })); // unreferenced check
    mockRemove.mockResolvedValue({ error: null });
    mockRecordDocShared.mockResolvedValue({ err: 'Access denied' });

    await expect(
      documentShareService.shareDocument(doc, 'tx1', 'conv-principal')
    ).rejects.toThrow(/consent/i);
    expect(mockRemove).toHaveBeenCalledWith([grantRow.object_path]);
  });

  it('should throw before any upload when no Supabase session exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(
      documentShareService.shareDocument(doc, 'tx1', 'conv-principal')
    ).rejects.toThrow(/sign in/i);
    expect(mockCopy).not.toHaveBeenCalled();
  });
});

describe('documentShareService.revokeShare', () => {
  const grant = {
    id: 'g1',
    transactionId: 'tx1',
    docHash: doc.fileHash,
    slotId: 'mortgageOffer',
    objectPath: grantRow.object_path,
    granteePrincipal: 'conv-principal',
    status: 'active' as const,
    createdAt: grantRow.created_at,
    revokedAt: null,
    expiresAt: null,
  };

  it('should revoke the grant, remove the last object and log on-chain', async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: null, error: null })) // update -> revoked
      .mockReturnValueOnce(chain({ data: [], error: null })); // no active grants left
    mockRemove.mockResolvedValue({ error: null });
    mockRecordDocShareRevoked.mockResolvedValue({ ok: null });

    const result = await documentShareService.revokeShare(grant);

    expect(mockRemove).toHaveBeenCalledWith([grant.objectPath]);
    expect(mockRecordDocShareRevoked).toHaveBeenCalledWith('tx1', doc.fileHash, 'conv-principal');
    expect(result.auditLogged).toBe(true);
  });

  it('should keep the object when other active grants still reference it', async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: null, error: null }))
      .mockReturnValueOnce(chain({ data: [{ id: 'g2' }], error: null }));
    mockRecordDocShareRevoked.mockResolvedValue({ ok: null });

    await documentShareService.revokeShare(grant);

    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('should still revoke and report auditLogged=false when the on-chain call fails', async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: null, error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }));
    mockRemove.mockResolvedValue({ error: null });
    mockRecordDocShareRevoked.mockResolvedValue({ err: 'boom' });

    const result = await documentShareService.revokeShare(grant);

    expect(result.auditLogged).toBe(false);
    expect(mockRemove).toHaveBeenCalled();
  });
});

describe('documentShareService.listGrantsForDoc / listGrantHistory', () => {
  it('should list active grants for a hash, optionally scoped to a deal', async () => {
    const eq = vi.fn();
    const builder: Record<string, unknown> = {};
    builder.select = vi.fn(() => builder);
    builder.eq = eq.mockImplementation(() => builder);
    builder.then = (resolve: (v: unknown) => void) => resolve({ data: [grantRow], error: null });
    mockFrom.mockReturnValueOnce(builder);
    const grants = await documentShareService.listGrantsForDoc(doc.fileHash, 'tx1');
    expect(grants).toHaveLength(1);
    expect(eq).toHaveBeenCalledWith('doc_hash', doc.fileHash);
    expect(eq).toHaveBeenCalledWith('status', 'active');
    expect(eq).toHaveBeenCalledWith('transaction_id', 'tx1');
  });

  it('should list the full grant history (active + revoked) for a deal, oldest first', async () => {
    const revoked = { ...grantRow, id: 'g0', status: 'revoked', revoked_at: '2026-07-20T10:00:00Z' };
    mockFrom.mockReturnValueOnce(chain({ data: [revoked, grantRow], error: null }));
    const history = await documentShareService.listGrantHistory('tx1');
    expect(history.map((g) => g.id)).toEqual(['g0', 'g1']);
    expect(history[0].status).toBe('revoked');
  });
});

describe('documentShareService completion expiry', () => {
  it('should set expires_at = completed + 14 days on active grants that have none', async () => {
    const b = chain({ data: null, error: null });
    mockFrom.mockReturnValueOnce(b);
    const completed = new Date('2026-09-01T12:00:00Z');
    const expiresAt = await documentShareService.scheduleExpiryForDeal('tx1', completed);
    expect(expiresAt).toBe('2026-09-15T12:00:00.000Z');
    expect(b.update).toHaveBeenCalledWith({ expires_at: '2026-09-15T12:00:00.000Z' });
    expect(b.eq).toHaveBeenCalledWith('transaction_id', 'tx1');
    expect(b.is).toHaveBeenCalledWith('expires_at', null);
  });

  it('should revoke every overdue grant and report the count', async () => {
    const overdue = { ...grantRow, expires_at: '2026-01-01T00:00:00Z' };
    mockFrom
      .mockReturnValueOnce(chain({ data: [overdue], error: null })) // overdue select
      .mockReturnValueOnce(chain({ data: null, error: null })) // update -> revoked
      .mockReturnValueOnce(chain({ data: [], error: null })); // no active grants left
    mockRemove.mockResolvedValue({ error: null });
    mockRecordDocShareRevoked.mockResolvedValue({ ok: null });
    await expect(documentShareService.expireOverdue('tx1')).resolves.toBe(1);
    expect(mockRemove).toHaveBeenCalledWith([grantRow.object_path]);
    expect(mockRecordDocShareRevoked).toHaveBeenCalled();
  });
});

describe('documentShareService.listMyGrants', () => {
  it('should map active grant rows to ShareGrant', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: [grantRow], error: null }));
    const grants = await documentShareService.listMyGrants('tx1');
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({
      id: 'g1',
      transactionId: 'tx1',
      granteePrincipal: 'conv-principal',
      status: 'active',
    });
  });
});
