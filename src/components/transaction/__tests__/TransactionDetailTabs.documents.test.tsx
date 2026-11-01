import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Transaction } from '../../../types/transaction.types';

const getDocumentsByTransaction = vi.fn();
const getDocumentStatus = vi.fn();

vi.mock('../../../services/icp.service', () => ({
  icpService: {
    initialize: async (): Promise<void> => undefined,
    getDocumentsByTransaction: (...a: unknown[]) => getDocumentsByTransaction(...a),
    getDocumentStatus: (...a: unknown[]) => getDocumentStatus(...a),
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

const deal = (id: string): Transaction => ({ id, seller: 'me', createdBy: 'me' }) as unknown as Transaction;

function openDocumentsTab(): void {
  fireEvent.click(screen.getByRole('button', { name: /Documents/ }));
}

describe('TransactionDetailTabs document list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDocumentStatus.mockResolvedValue([]);
  });

  it('should say the read failed, not that nothing was uploaded', async () => {
    // Arrange
    getDocumentsByTransaction.mockRejectedValue(new Error('update rejected'));

    // Act
    render(<TransactionDetailTabs transaction={deal('tx_1')} />);
    openDocumentsTab();

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load your documents.");
    expect(screen.queryByText('No documents uploaded yet')).not.toBeInTheDocument();
  });

  it('should load again from the retry button', async () => {
    // Arrange
    getDocumentsByTransaction.mockRejectedValueOnce(new Error('update rejected')).mockResolvedValue([]);
    render(<TransactionDetailTabs transaction={deal('tx_1')} />);
    openDocumentsTab();

    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    // Assert
    expect(await screen.findByText('No documents uploaded yet')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(getDocumentsByTransaction).toHaveBeenCalledTimes(2);
  });

  it('should still say nothing was uploaded when the read works and the deal is empty', async () => {
    // Arrange
    getDocumentsByTransaction.mockResolvedValue([]);

    // Act
    render(<TransactionDetailTabs transaction={deal('tx_1')} />);
    openDocumentsTab();

    // Assert
    expect(await screen.findByText('No documents uploaded yet')).toBeInTheDocument();
  });

  it('should ignore a status reply for the deal the panel has moved away from', async () => {
    // Arrange
    let finishOldStatus: (rows: unknown[]) => void = () => undefined;
    getDocumentsByTransaction.mockResolvedValue([]);
    getDocumentStatus.mockImplementation((id: string) =>
      id === 'tx_1'
        ? new Promise((resolve) => {
            finishOldStatus = resolve;
          })
        : Promise.resolve([]),
    );
    const { rerender } = render(<TransactionDetailTabs transaction={deal('tx_1')} />);
    openDocumentsTab();
    await waitFor(() => expect(getDocumentStatus).toHaveBeenCalledWith('tx_1'));

    // Act
    rerender(<TransactionDetailTabs transaction={deal('tx_2')} />);
    await waitFor(() => expect(getDocumentStatus).toHaveBeenCalledWith('tx_2'));
    await act(async () => finishOldStatus([{ category: 'funds', verified: true, uploadedAtNs: '1' }]));

    // Assert
    expect(screen.queryByText('Buyer funds: received')).not.toBeInTheDocument();
  });
});
