import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VaultDocument } from '../../types/vault.types';

const mockFrom = vi.fn();
const mockInvoke = vi.fn();
const mockGetSession = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => mockFrom(...a),
    functions: { invoke: (...a: unknown[]) => mockInvoke(...a) },
    auth: { getSession: () => mockGetSession() },
  },
}));

const mockGetDocumentProof = vi.fn();
vi.mock('../icp.service', () => ({
  icpService: { getDocumentProof: (...a: unknown[]) => mockGetDocumentProof(...a) },
}));

import { walletProofService, buildProofItem, MAX_ACTIVE_PROOFS_PER_DEAL } from '../walletProof.service';

function chain(result: { data?: unknown; error?: { message: string } | null }): Record<string, unknown> {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'gt', 'order', 'insert', 'update', 'single']) b[m] = vi.fn(() => b);
  b.then = (resolve: (v: unknown) => void) => resolve(result);
  return b;
}

const doc: VaultDocument = {
  id: 'row-1',
  slotId: 'custom1',
  blockchainId: 7,
  fileHash: 'a'.repeat(64),
  fileSize: 1,
  mimeType: 'application/pdf',
  uploadedAt: '2026-08-18T10:00:00.000Z',
  objectPath: 'wallet/uid-1/custom1-aaaaaaaaaaaa.pdf',
  label: 'Barclays March',
};
const row = {
  id: 'pl-1',
  transaction_id: 'tx1',
  token: 'f'.repeat(64),
  items: [],
  status: 'active',
  expires_at: '2026-08-19T10:00:00Z',
  view_count: 2,
  last_viewed_at: null,
  created_at: '2026-08-18T10:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockReset();
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'uid-1' } } } });
});

describe('buildProofItem', () => {
  it('should snapshot generic slot label + hash prefix and mark verified when the on-chain hash matches', async () => {
    mockGetDocumentProof.mockResolvedValue({ fileHash: 'A'.repeat(64), uploadedAt: 1_755_500_000_000_000_000 });
    const item = await buildProofItem(doc);
    expect(item.slotLabel).toBe('Custom document'); // never the user's custom name or label
    expect(item.hashPrefix).toBe('a'.repeat(12));
    expect(item.blockchainId).toBe(7);
    expect(item.verifiedAt).toBeTruthy();
    expect(item.anchoredAt).toBe(new Date(1_755_500_000_000).toISOString());
    expect(JSON.stringify(item)).not.toMatch(/Barclays/);
  });

  it('should leave verifiedAt null when the on-chain hash differs or the lookup fails', async () => {
    mockGetDocumentProof.mockResolvedValue({ fileHash: 'b'.repeat(64), uploadedAt: 1 });
    expect((await buildProofItem(doc)).verifiedAt).toBeNull();
    mockGetDocumentProof.mockRejectedValue(new Error('down'));
    expect((await buildProofItem(doc)).verifiedAt).toBeNull();
  });
});

describe('walletProofService.create', () => {
  it('should insert a 64-hex token with a 24h expiry and the snapshotted items', async () => {
    mockGetDocumentProof.mockResolvedValue({ fileHash: doc.fileHash, uploadedAt: 1 });
    const insertSpy = vi.fn((_arg: unknown) => chain({ data: row, error: null }));
    mockFrom
      .mockReturnValueOnce(chain({ data: [], error: null })) // listActive
      .mockReturnValueOnce({ insert: insertSpy });
    const link = await walletProofService.create('tx1', [doc]);
    const arg = insertSpy.mock.calls[0][0] as unknown as { token: string; expires_at: string; items: unknown[]; user_id: string };
    expect(arg.token).toMatch(/^[a-f0-9]{64}$/);
    expect(arg.user_id).toBe('uid-1');
    expect(new Date(arg.expires_at).getTime() - Date.now()).toBeGreaterThan(23 * 3600_000);
    expect(arg.items).toHaveLength(1);
    expect(link.id).toBe('pl-1');
  });

  it('should refuse a 6th active proof for a deal', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: Array(MAX_ACTIVE_PROOFS_PER_DEAL).fill(row), error: null }));
    await expect(walletProofService.create('tx1', [doc])).rejects.toThrow(/revoke one first/);
  });

  it('should refuse an empty selection', async () => {
    await expect(walletProofService.create('tx1', [])).rejects.toThrow(/at least one/);
  });
});

describe('walletProofService reads / revoke / public', () => {
  it('should map rows and revoke by id', async () => {
    mockFrom.mockReturnValueOnce(chain({ data: [row], error: null }));
    const links = await walletProofService.listActive('tx1');
    expect(links[0]).toMatchObject({ id: 'pl-1', viewCount: 2, status: 'active' });

    const eq = vi.fn(() => chain({ data: null, error: null }));
    const update = vi.fn(() => ({ eq }));
    mockFrom.mockReturnValueOnce({ update });
    await walletProofService.revoke(links[0]);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'revoked' }));
    expect(eq).toHaveBeenCalledWith('id', 'pl-1');
  });

  it('should fetch the public proof through the edge function and return null on 404', async () => {
    mockInvoke.mockResolvedValue({ data: { items: [{ slotLabel: 'Proof of Identity' }], expiresAt: 'x', generatedAt: 'y' }, error: null });
    const proof = await walletProofService.fetchPublic('f'.repeat(64));
    expect(mockInvoke).toHaveBeenCalledWith('wallet-proof-view', { body: { token: 'f'.repeat(64) } });
    expect(proof?.items[0].slotLabel).toBe('Proof of Identity');
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'not found' } });
    expect(await walletProofService.fetchPublic('f'.repeat(64))).toBeNull();
  });

  it('should build the public URL under /proof/', () => {
    expect(walletProofService.proofUrlFor('abc')).toMatch(/\/proof\/abc$/);
  });
});
