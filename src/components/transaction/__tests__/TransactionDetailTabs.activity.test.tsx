import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Transaction } from '../../../types/transaction.types';

const getDocumentsByTransaction = vi.fn();
const getDocumentStatus = vi.fn();
const fetchDocumentAuditLogs = vi.fn();

vi.mock('../../../services/icp.service', () => ({
  icpService: {
    initialize: async (): Promise<void> => undefined,
    getDocumentsByTransaction: (...a: unknown[]) => getDocumentsByTransaction(...a),
    getDocumentStatus: (...a: unknown[]) => getDocumentStatus(...a),
    fetchDocumentAuditLogs: (...a: unknown[]) => fetchDocumentAuditLogs(...a),
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../common/DocumentUpload', () => ({ default: (): null => null }));
vi.mock('../../forms/TA6Form', () => ({ default: (): null => null }));
vi.mock('../../forms/TA10Form', () => ({ default: (): null => null }));
vi.mock('../../forms/TA7Form', () => ({ default: (): null => null }));
vi.mock('../LegalTab', () => ({ default: (): null => null }));

import TransactionDetailTabs from '../TransactionDetailTabs';

const deal = { id: 'tx_1', seller: 'me', createdBy: 'me' } as unknown as Transaction;
const OLD_HASH = 'ab'.repeat(32);
const NEW_HASH = 'cd'.repeat(32);
const actor = { toString: (): string => 'rrkah-fqaaa-aaaaa-aaaaq-cai' };

describe('TransactionDetailTabs document activity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDocumentStatus.mockResolvedValue([]);
    getDocumentsByTransaction.mockResolvedValue([{ id: 'd1', type: 'epc', storageDocumentId: 7 }]);
  });

  it('should show an entry in the code form as a sentence and an older entry as before', async () => {
    // Arrange
    fetchDocumentAuditLogs.mockResolvedValue([
      { id: 1n, action: 'REGISTER', timestamp: 1_700_000_000_000_000_000n, actorPrincipal: actor,
        metadata: `Hash: ${OLD_HASH}, Type: epc` },
      { id: 2n, action: 'REGISTER', timestamp: 1_800_000_000_000_000_000n, actorPrincipal: actor,
        metadata: `doc_registered;hash=${NEW_HASH};docType=epc` },
    ]);
    render(<TransactionDetailTabs transaction={deal} />);
    // The documents load first: the activity read waits for them.
    fireEvent.click(screen.getByRole('button', { name: /Documents/ }));
    await screen.findByRole('button', { name: /Activity/ });

    // Act
    fireEvent.click(screen.getByRole('button', { name: /Activity/ }));

    // Assert
    expect(await screen.findByText('EPC registered on-chain')).toBeInTheDocument();
    expect(screen.getByText('REGISTER')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(NEW_HASH.slice(0, 16)))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(OLD_HASH.slice(0, 16)))).toBeInTheDocument();
    expect(fetchDocumentAuditLogs).toHaveBeenCalledWith(7);
  });
});
