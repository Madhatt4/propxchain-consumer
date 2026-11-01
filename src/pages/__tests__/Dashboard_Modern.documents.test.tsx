import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMyTransactions = vi.fn();
const getDocumentsByTransaction = vi.fn();
const getDocumentStatus = vi.fn();

vi.mock('../../services/icp.service', () => ({
  icpService: {
    initAuth: async (): Promise<void> => undefined,
    initialize: async (): Promise<void> => undefined,
    getMyProfile: async (): Promise<Record<string, unknown>> => ({ userType: { diy_seller: null } }),
    getMyTransactions: (...a: unknown[]) => getMyTransactions(...a),
    getDocumentsByTransaction: (...a: unknown[]) => getDocumentsByTransaction(...a),
    getDocumentStatus: (...a: unknown[]) => getDocumentStatus(...a),
    transactionManager: { getInviteCode: async (): Promise<Record<string, string>> => ({ ok: 'CODE' }) },
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../components/common/RateLimitIndicator', () => ({ default: (): null => null }));
vi.mock('../../components/navigation/DashboardSidebar', () => ({
  default: (): null => null,
}));

import DashboardModern from '../Dashboard_Modern';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { useAuthStore } from '../../stores/authStore';

const deal = (id: string): Record<string, unknown> => ({
  id,
  seller: 'me',
  createdBy: 'me',
  status: 'active',
  propertyAddress: `Address ${id}`,
  parties: [],
  accessList: [],
  milestones: [],
});

const titleHidden = [{ category: 'title', verified: true, uploadedAtNs: '100' }];

const Navigate: React.FC = () => {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate('?tx=tx_2')}>go-2</button>
      <button type="button" onClick={() => navigate('?tx=tx_1&again=1')}>again-1</button>
    </>
  );
};

function renderDashboard(): void {
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/?tx=tx_1']}>
        <DashboardModern />
        <Navigate />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('Dashboard_Modern document status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ principalId: 'me', isAuthenticated: true });
    getMyTransactions.mockResolvedValue([deal('tx_1'), deal('tx_2')]);
    getDocumentsByTransaction.mockResolvedValue([]);
    getDocumentStatus.mockResolvedValue([]);
  });

  it('should keep the last status lines when a later status read fails', async () => {
    // Arrange
    getDocumentStatus.mockResolvedValue(titleHidden);
    renderDashboard();
    expect(await screen.findByText('Title deeds: received')).toBeInTheDocument();
    getDocumentStatus.mockRejectedValue(new Error('status down'));
    const callsBefore = getDocumentStatus.mock.calls.length;

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'again-1' }));
    await waitFor(() => expect(getDocumentStatus.mock.calls.length).toBeGreaterThan(callsBefore));
    await act(async () => undefined);

    // Assert
    expect(screen.getByText('Title deeds: received')).toBeInTheDocument();
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

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'go-2' }));
    await waitFor(() => expect(getDocumentStatus).toHaveBeenCalledWith('tx_2'));
    await act(async () => finishOldList([]));

    // Assert
    expect(screen.queryByText('Title deeds: received')).not.toBeInTheDocument();
  });

  it('should not carry status lines over to another deal', async () => {
    // Arrange
    getDocumentStatus.mockImplementation(async (id: string) => {
      if (id === 'tx_1') return titleHidden;
      throw new Error('status down');
    });
    renderDashboard();
    expect(await screen.findByText('Title deeds: received')).toBeInTheDocument();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'go-2' }));
    await waitFor(() => expect(getDocumentStatus).toHaveBeenCalledWith('tx_2'));
    await act(async () => undefined);

    // Assert
    expect(screen.queryByText('Title deeds: received')).not.toBeInTheDocument();
  });
});
