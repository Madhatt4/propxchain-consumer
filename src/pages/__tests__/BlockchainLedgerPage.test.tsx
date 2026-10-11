import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../components/navigation/DashboardSidebar', () => ({ default: () => <nav /> }));
vi.mock('../../components/navigation/DashboardHeader', () => ({ default: () => <header /> }));
vi.mock('../../components/subscription/UpgradePrompt', () => ({ default: () => <div /> }));
vi.mock('../../hooks/useSubscription', () => ({ useCanAccessFeature: () => true }));
vi.mock('../../stores/authStore', () => ({
  useAuthStore: { getState: () => ({ principalId: 'principal-me', isAuthenticated: true }) },
}));

const getMyTransactions = vi.fn();
const getAllTransactions = vi.fn();
const getDocumentsByTransaction = vi.fn();
vi.mock('../../services/icp.service', () => ({
  icpService: {
    getMyTransactions: (...a: unknown[]) => getMyTransactions(...a),
    getAllTransactions: (...a: unknown[]) => getAllTransactions(...a),
    getDocumentsByTransaction: (...a: unknown[]) => getDocumentsByTransaction(...a),
  },
}));

import BlockchainLedgerPage from '../BlockchainLedgerPage';

const VERIFIED_HASH = 'aaaa1111bbbb2222cccc' + '0'.repeat(44);
const UNVERIFIED_HASH = 'dddd3333eeee4444ffff' + '0'.repeat(44);

async function openDocumentLedger(): Promise<HTMLElement> {
  render(
    <MemoryRouter>
      <BlockchainLedgerPage />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /Document Ledger/ }));
  return screen.getByRole('table');
}

function rowFor(table: HTMLElement, name: string): HTMLElement {
  const row = within(table).getByText(name).closest('tr');
  if (!row) throw new Error(`no row for ${name}`);
  return row;
}

describe('BlockchainLedgerPage document ledger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    getMyTransactions.mockResolvedValue([{ id: 'tx_1', propertyAddress: '1 Test Street', status: 'active' }]);
    localStorage.setItem(
      'transactions',
      JSON.stringify([{ id: 'tx_1', uploadedDocuments: [{ name: 'Local Survey', size: 1024 }] }]),
    );
    getDocumentsByTransaction.mockResolvedValue([
      { id: 'doc_1', name: 'Title Deeds', type: 'titleDeeds', hash: VERIFIED_HASH, verified: true, uploadedBy: 'principal-me' },
      { id: 'doc_2', name: 'EPC', type: 'epc', hash: UNVERIFIED_HASH, verified: false },
    ]);
  });

  it('should show the real canister hash and Verified for a document document_storage marks verified', async () => {
    // Arrange / Act
    const table = await openDocumentLedger();

    // Assert
    const row = rowFor(table, 'Title Deeds');
    expect(within(row).getByText(`${VERIFIED_HASH.substring(0, 20)}...`)).toBeInTheDocument();
    expect(within(row).getByText('Verified')).toBeInTheDocument();
    expect(within(row).getByText('by you')).toBeInTheDocument();
  });

  it('should show an on-chain document as unverified when the canister verified flag is false', async () => {
    // Arrange / Act
    const table = await openDocumentLedger();

    // Assert
    const row = rowFor(table, 'EPC');
    expect(within(row).getByText(`${UNVERIFIED_HASH.substring(0, 20)}...`)).toBeInTheDocument();
    expect(within(row).getByText('On chain · unverified')).toBeInTheDocument();
    expect(within(row).queryByText('Verified')).not.toBeInTheDocument();
  });

  it('should show a document with no on-chain hash as not recorded on chain, with no invented hash', async () => {
    // Arrange / Act
    const table = await openDocumentLedger();

    // Assert
    const row = rowFor(table, 'Local Survey');
    expect(within(row).getByText('No hash on chain')).toBeInTheDocument();
    expect(within(row).getByText('Not recorded on chain')).toBeInTheDocument();
    expect(row.textContent).not.toMatch(/hash_/);
  });

  it('should say the chain could not be checked when the document lookup throws', async () => {
    // Arrange
    getDocumentsByTransaction.mockRejectedValue(new Error('rate limited'));

    // Act
    const table = await openDocumentLedger();

    // Assert
    const row = rowFor(table, 'Local Survey');
    expect(within(row).getByText("Couldn't check chain")).toBeInTheDocument();
  });

  it('should ask document_storage for each transaction by its id', async () => {
    // Arrange / Act
    await openDocumentLedger();

    // Assert
    expect(getDocumentsByTransaction).toHaveBeenCalledWith('tx_1');
  });
});

describe('BlockchainLedgerPage transaction source', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    getDocumentsByTransaction.mockResolvedValue([]);
  });

  it("should load the caller's own transactions, not the admin-only list that is empty for non-admins", async () => {
    // Arrange
    getMyTransactions.mockResolvedValue([{ id: 'tx_mine', propertyAddress: '2 Own Road', status: 'active' }]);
    getAllTransactions.mockResolvedValue([]);

    // Act
    render(
      <MemoryRouter>
        <BlockchainLedgerPage />
      </MemoryRouter>,
    );

    // Assert
    expect(await screen.findByText('2 Own Road')).toBeInTheDocument();
    expect(getMyTransactions).toHaveBeenCalledTimes(1);
    expect(getAllTransactions).not.toHaveBeenCalled();
  });
});
