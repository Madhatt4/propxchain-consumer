import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Transaction } from '../../types/transaction.types';

const fetchTransactionDocuments = vi.fn();
const getDocumentStatus = vi.fn();

vi.mock('../../services/icp.service', () => ({
  icpService: {
    ensureDocumentStorageActor: async (): Promise<void> => undefined,
    fetchTransactionDocuments: (...a: unknown[]) => fetchTransactionDocuments(...a),
    getDocumentStatus: (...a: unknown[]) => getDocumentStatus(...a),
    getMyTransactions: async (): Promise<unknown[]> => [],
    initialize: async (): Promise<void> => undefined,
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { SplitPanelProvider, useSplitPanel } from '../SplitPanelContext';

const Probe: React.FC = () => {
  const { setSelectedTransaction, transactionDocuments, hiddenDocumentStatus, documentsError } = useSplitPanel();
  return (
    <div>
      <button type="button" onClick={() => setSelectedTransaction({ id: 'tx_1' } as Transaction)}>
        open
      </button>
      <span data-testid="listed">{transactionDocuments.length}</span>
      <span data-testid="hidden">{hiddenDocumentStatus.map((row) => row.category).join(',')}</span>
      <span data-testid="error">{documentsError ?? ''}</span>
    </div>
  );
};

function openDeal(): void {
  render(
    <SplitPanelProvider>
      <Probe />
    </SplitPanelProvider>,
  );
  act(() => screen.getByRole('button', { name: 'open' }).click());
}

describe('SplitPanelContext document loading', () => {
  const listed = { id: 1n, uploadedAt: 100n, uploadedBy: 'me', transactionId: ['tx_1'] };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should expose only the documents missing from the list as hidden', async () => {
    // Arrange
    fetchTransactionDocuments.mockResolvedValue([listed]);
    getDocumentStatus.mockResolvedValue([
      { category: 'title', verified: true, uploadedAtNs: '100' },
      { category: 'funds', verified: true, uploadedAtNs: '200' },
    ]);

    // Act
    openDeal();

    // Assert
    await waitFor(() => expect(screen.getByTestId('hidden')).toHaveTextContent('funds'));
    expect(screen.getByTestId('listed')).toHaveTextContent('1');
  });

  it('should still show the list when the status read fails', async () => {
    // Arrange
    fetchTransactionDocuments.mockResolvedValue([listed]);
    getDocumentStatus.mockRejectedValue(new Error('status down'));

    // Act
    openDeal();

    // Assert
    await waitFor(() => expect(screen.getByTestId('listed')).toHaveTextContent('1'));
    expect(screen.getByTestId('error')).toHaveTextContent('');
  });

  it('should report an error, not an empty deal, when the document read fails', async () => {
    // Arrange
    fetchTransactionDocuments.mockRejectedValue(new Error('update rejected'));
    getDocumentStatus.mockResolvedValue([]);

    // Act
    openDeal();

    // Assert
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('update rejected'));
  });
});
