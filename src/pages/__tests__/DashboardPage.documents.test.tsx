import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMyTransactions = vi.fn();
const getDocumentsByTransaction = vi.fn();
const getDocumentStatus = vi.fn();

vi.mock('../../services/icp.service', () => ({
  icpService: {
    initialize: async (): Promise<void> => undefined,
    getMyTransactions: (...a: unknown[]) => getMyTransactions(...a),
    getDocumentsByTransaction: (...a: unknown[]) => getDocumentsByTransaction(...a),
    getDocumentStatus: (...a: unknown[]) => getDocumentStatus(...a),
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../components/dashboard/DocumentVerificationGrid', () => ({
  default: ({ documents }: { documents: Array<{ name: string; status: string }> }): React.ReactElement => (
    <ul>
      {documents.map((doc) => (
        <li key={doc.name}>{`${doc.name}=${doc.status}`}</li>
      ))}
    </ul>
  ),
}));
vi.mock('../../components/TransactionInvite', () => ({ default: (): null => null }));
vi.mock('../../components/ChainView', () => ({ default: (): null => null }));
vi.mock('../../components/navigation/MobileNavMenu', () => ({ default: (): null => null }));

import DashboardPage from '../DashboardPage';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { useAuthStore } from '../../stores/authStore';

const deal = (id: string): Record<string, unknown> => ({
  id,
  seller: 'me',
  createdBy: 'me',
  status: 'active',
  parties: [],
  accessList: [],
});

const titleHidden = [{ category: 'title', verified: true, uploadedAtNs: '100' }];

async function showDeal(id: string): Promise<void> {
  getMyTransactions.mockResolvedValue([deal(id)]);
  await act(async () => {
    window.dispatchEvent(new Event('focus'));
  });
}

function renderDashboard(): void {
  render(
    <ThemeProvider>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('DashboardPage document progress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ principalId: 'me', isAuthenticated: true });
    getMyTransactions.mockResolvedValue([deal('tx_1')]);
    getDocumentsByTransaction.mockResolvedValue([]);
    getDocumentStatus.mockResolvedValue([]);
  });

  it('should keep the last status for a deal when a later status read fails', async () => {
    // Arrange
    getDocumentStatus.mockResolvedValue(titleHidden);
    renderDashboard();
    expect(await screen.findByText('Title Deeds=verified')).toBeInTheDocument();
    getDocumentStatus.mockResolvedValue([]);
    await showDeal('tx_2');
    expect(await screen.findByText('Title Deeds=pending')).toBeInTheDocument();

    // Act
    getDocumentStatus.mockRejectedValue(new Error('status down'));
    await showDeal('tx_1');

    // Assert
    expect(await screen.findByText('Title Deeds=verified')).toBeInTheDocument();
  });

  it('should ignore a late reply for the deal it has moved away from', async () => {
    // Arrange
    let finishOldList: (rows: unknown[]) => void = () => undefined;
    getDocumentsByTransaction.mockImplementation((id: string) =>
      id === 'tx_1'
        ? new Promise((resolve) => {
            finishOldList = resolve;
          })
        : Promise.resolve([]),
    );
    getDocumentStatus.mockImplementation(async (id: string) => (id === 'tx_1' ? titleHidden : []));
    renderDashboard();
    await waitFor(() => expect(getDocumentsByTransaction).toHaveBeenCalledWith('tx_1'));
    await showDeal('tx_2');
    await waitFor(() => expect(getDocumentsByTransaction).toHaveBeenCalledWith('tx_2'));

    // Act
    await act(async () => finishOldList([]));

    // Assert
    expect(await screen.findByText('Title Deeds=pending')).toBeInTheDocument();
    expect(screen.queryByText('Title Deeds=verified')).not.toBeInTheDocument();
  });
});
