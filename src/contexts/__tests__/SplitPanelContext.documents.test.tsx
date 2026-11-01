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
  const { setSelectedTransaction, transactionDocuments, hiddenDocumentStatus, documentsError, documentsLoading } =
    useSplitPanel();
  return (
    <div>
      <button type="button" onClick={() => setSelectedTransaction({ id: 'tx_1' } as Transaction)}>
        open
      </button>
      <button type="button" onClick={() => setSelectedTransaction({ id: 'tx_2' } as Transaction)}>
        switch
      </button>
      <span data-testid="listed">{transactionDocuments.length}</span>
      <span data-testid="hidden">{hiddenDocumentStatus.map((row) => row.category).join(',')}</span>
      <span data-testid="error">{documentsError ?? ''}</span>
      <span data-testid="loading">{String(documentsLoading)}</span>
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

  describe('when the user switches deal while a read is in flight', () => {
    const lateRead = <T,>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (e: Error) => void } => {
      let resolve!: (value: T) => void;
      let reject!: (e: Error) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
    const otherDeal = { id: 2n, uploadedAt: 300n, uploadedBy: 'me', transactionId: ['tx_2'] };

    it('should keep the new deal documents and status when the old reply lands last', async () => {
      // Arrange
      const dealOne = lateRead<unknown[]>();
      fetchTransactionDocuments.mockImplementation((id: string) =>
        id === 'tx_1' ? dealOne.promise : Promise.resolve([otherDeal]),
      );
      getDocumentStatus.mockImplementation(async (id: string) =>
        id === 'tx_1'
          ? [{ category: 'title', verified: true, uploadedAtNs: '999' }]
          : [{ category: 'funds', verified: true, uploadedAtNs: '400' }],
      );

      // Act
      openDeal();
      act(() => screen.getByRole('button', { name: 'switch' }).click());
      await waitFor(() => expect(screen.getByTestId('hidden')).toHaveTextContent('funds'));
      await act(async () => dealOne.resolve([listed, listed, listed]));

      // Assert
      expect(screen.getByTestId('listed')).toHaveTextContent('1');
      expect(screen.getByTestId('hidden')).toHaveTextContent('funds');
      expect(screen.getByTestId('hidden')).not.toHaveTextContent('title');
    });

    it('should not show the old deal error on the new deal', async () => {
      // Arrange
      const dealOne = lateRead<unknown[]>();
      fetchTransactionDocuments.mockImplementation((id: string) =>
        id === 'tx_1' ? dealOne.promise : Promise.resolve([otherDeal]),
      );
      getDocumentStatus.mockResolvedValue([]);

      // Act
      openDeal();
      act(() => screen.getByRole('button', { name: 'switch' }).click());
      await waitFor(() => expect(screen.getByTestId('listed')).toHaveTextContent('1'));
      await act(async () => dealOne.reject(new Error('old deal failed')));

      // Assert
      expect(screen.getByTestId('error')).toHaveTextContent('');
    });

    it('should keep the spinner until the new read finishes, not the old one', async () => {
      // Arrange
      const dealOne = lateRead<unknown[]>();
      const dealTwo = lateRead<unknown[]>();
      fetchTransactionDocuments.mockImplementation((id: string) =>
        id === 'tx_1' ? dealOne.promise : dealTwo.promise,
      );
      getDocumentStatus.mockResolvedValue([]);

      // Act
      openDeal();
      act(() => screen.getByRole('button', { name: 'switch' }).click());
      await act(async () => dealOne.resolve([listed]));

      // Assert
      expect(screen.getByTestId('loading')).toHaveTextContent('true');
      await act(async () => dealTwo.resolve([otherDeal]));
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    it('should clear the old deal documents when the new deal read fails', async () => {
      // Arrange
      fetchTransactionDocuments.mockImplementation((id: string) =>
        id === 'tx_1' ? Promise.resolve([listed]) : Promise.reject(new Error('update rejected')),
      );
      getDocumentStatus.mockResolvedValue([]);

      // Act
      openDeal();
      await waitFor(() => expect(screen.getByTestId('listed')).toHaveTextContent('1'));
      act(() => screen.getByRole('button', { name: 'switch' }).click());

      // Assert
      await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('update rejected'));
      expect(screen.getByTestId('listed')).toHaveTextContent('0');
    });
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
