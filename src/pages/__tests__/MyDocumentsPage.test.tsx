import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Sidebar pulls in stores/router; stub it to keep this test focused on the page.
vi.mock('@/components/navigation/AppTopBar', () => ({ default: () => <nav /> }));

const listMyDocuments = vi.fn();
vi.mock('../../services/vaultDocument.service', () => ({
  vaultDocumentService: {
    listMyDocuments: (...a: unknown[]) => listMyDocuments(...a),
    getCustomSlotName: () => null,
    setCustomSlotName: vi.fn(),
  },
  validateVaultFile: () => null,
}));
vi.mock('../../services/icp.service', () => ({
  icpService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getUserPrincipal: vi.fn().mockResolvedValue('principal-abc'),
  },
}));
// Keep the tier source simple and offline.
vi.mock('../../hooks/useSubscription', () => ({
  useSubscription: () => ({ tier: 'starter' }),
}));
const listLegacy = vi.fn();
vi.mock('@/services/vaultMigration.service', () => ({
  vaultMigrationService: {
    listLegacy: (...a: unknown[]) => listLegacy(...a),
    migrateAll: vi.fn(),
  },
}));

import MyDocumentsPage from '../MyDocumentsPage';

describe('MyDocumentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMyDocuments.mockResolvedValue([]);
    listLegacy.mockResolvedValue([]);
  });

  it('should render all six wallet slots (4 pinned + 2 custom) under the PropXchain Wallet heading', async () => {
    render(
      <MemoryRouter>
        <MyDocumentsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('AML / Source of Funds')).toBeInTheDocument();
    expect(screen.getByText('Proof of Identity')).toBeInTheDocument();
    expect(screen.getByText('Mortgage Offer')).toBeInTheDocument();
    expect(screen.getByText('Proof of Ownership')).toBeInTheDocument();
    expect(screen.getByText('Custom Slot 1')).toBeInTheDocument();
    expect(screen.getByText('Custom Slot 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /PropXchain Wallet/ })).toBeInTheDocument();
    expect(listMyDocuments).toHaveBeenCalledWith();
  });

  it('should label the DIP and mortgage-offer slots for buyers', async () => {
    render(
      <MemoryRouter>
        <MyDocumentsPage />
      </MemoryRouter>,
    );
    expect(await screen.findAllByText('(buyers)')).toHaveLength(2); // Decision in Principle + Mortgage Offer
  });

  it('should show a stored document returned by the service', async () => {
    listMyDocuments.mockResolvedValue([
      {
        id: 'row-7',
        slotId: 'proofOfId',
        blockchainId: 7,
        fileHash: 'a'.repeat(64),
        fileSize: 10 * 1024,
        mimeType: 'application/pdf',
        uploadedAt: '2026-07-13T10:00:00.000Z',
        objectPath: 'wallet/uid-1/proofOfId-aaaaaaaaaaaa.pdf',
      },
    ]);
    render(
      <MemoryRouter>
        <MyDocumentsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/aaaaaaaa…aaaaaaaa/)).toBeInTheDocument();
    expect(screen.getByText('1 / 10')).toBeInTheDocument();
  });
});
