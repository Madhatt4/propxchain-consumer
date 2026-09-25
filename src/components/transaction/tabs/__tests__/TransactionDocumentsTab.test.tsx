import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockListMyDocuments = vi.fn();
vi.mock('@/services/vaultDocument.service', () => ({
  vaultDocumentService: {
    listMyDocuments: (...a: unknown[]) => mockListMyDocuments(...a),
    getCustomSlotName: vi.fn(() => null),
  },
}));

vi.mock('@/services/icp.service', () => ({
  icpService: {
    initialize: vi.fn(async () => undefined),
    getUserPrincipal: vi.fn(async () => 'me-principal'),
  },
}));

const mockLoadRoster = vi.fn();
vi.mock('@/services/shareParty.service', async () => {
  const actual = await vi.importActual<typeof import('@/services/shareParty.service')>('@/services/shareParty.service');
  return {
    ...actual,
    sharePartyService: { loadRoster: (...a: unknown[]) => mockLoadRoster(...a) },
  };
});

const mockListMyGrants = vi.fn();
const mockListGrantHistory = vi.fn();
const mockShareDocument = vi.fn();
const mockRevokeShare = vi.fn();
vi.mock('@/services/documentShare.service', () => ({
  COMPLETION_GRACE_DAYS: 14,
  documentShareService: {
    listMyGrants: (...a: unknown[]) => mockListMyGrants(...a),
    listGrantHistory: (...a: unknown[]) => mockListGrantHistory(...a),
    shareDocument: (...a: unknown[]) => mockShareDocument(...a),
    revokeShare: (...a: unknown[]) => mockRevokeShare(...a),
  },
}));

const mockListSent = vi.fn();
const mockSend = vi.fn();
const mockUnsend = vi.fn();
vi.mock('@/services/transactionWallet.service', () => ({
  transactionWalletService: {
    listSent: (...a: unknown[]) => mockListSent(...a),
    send: (...a: unknown[]) => mockSend(...a),
    unsend: (...a: unknown[]) => mockUnsend(...a),
  },
}));

const mockListAllProofs = vi.fn();
const mockCreateProof = vi.fn();
vi.mock('@/services/walletProof.service', () => ({
  PROOF_TTL_HOURS: 24,
  walletProofService: {
    listAll: (...a: unknown[]) => mockListAllProofs(...a),
    create: (...a: unknown[]) => mockCreateProof(...a),
    revoke: vi.fn(),
    proofUrlFor: (t: string) => `https://app.test/proof/${t}`,
  },
}));
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,QR') } }));

const mockLifecycle = vi.fn();
vi.mock('@/services/walletCompletion', () => ({
  applyCompletionLifecycle: (...a: unknown[]) => mockLifecycle(...a),
}));

const mockLoadBuyerPack = vi.fn();
vi.mock('@/services/buyerPack.service', () => ({
  loadBuyerPack: (...a: unknown[]) => mockLoadBuyerPack(...a),
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { TransactionDocumentsTab } from '../TransactionDocumentsTab';

const doc = {
  id: 'row-1',
  slotId: 'mortgageOffer' as const,
  blockchainId: 42,
  fileHash: 'a'.repeat(64),
  fileSize: 1000,
  mimeType: 'application/pdf',
  uploadedAt: '2026-07-16T00:00:00Z',
  objectPath: 'wallet/uid-1/mortgageOffer-aaaaaaaaaaaa.pdf',
  label: 'Halifax offer',
};
const otherDoc = { ...doc, id: 'row-2', slotId: 'proofOfId' as const, fileHash: 'b'.repeat(64), label: undefined };
const sentItem = { itemId: 'item-1', sentAt: '2026-08-18T09:00:00Z', doc };

const myConv = { principal: 'conv-p', label: 'Conveyancer — Smith & Co', role: 'conveyancer' as const, side: 'buyer' as const };
const seller = { principal: 'seller-p', label: 'Seller — Sam S.', role: 'seller' as const, side: 'seller' as const };

const activeGrant = {
  id: 'g1',
  transactionId: 'tx1',
  docHash: doc.fileHash,
  slotId: 'mortgageOffer',
  objectPath: 'shared/tx1/uid-1/mortgageOffer-aaaaaaaaaaaa.pdf',
  granteePrincipal: 'conv-p',
  status: 'active' as const,
  createdAt: '2026-08-03T10:00:00Z',
  revokedAt: null,
  expiresAt: null,
};

const props = { transactionId: 'tx1', locked: false, requiredTier: 'starter' as const };

function renderTab(): void {
  render(
    <MemoryRouter>
      <TransactionDocumentsTab {...props} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListMyDocuments.mockResolvedValue([doc, otherDoc]);
  mockListSent.mockResolvedValue([sentItem]);
  mockLoadRoster.mockResolvedValue({ mySide: 'buyer', parties: [myConv, seller] });
  mockListMyGrants.mockResolvedValue([]);
  mockListGrantHistory.mockResolvedValue([]);
  mockListAllProofs.mockResolvedValue([]);
  mockLifecycle.mockResolvedValue({ isCompleted: false, accessEndsAt: null, expiredNow: 0 });
  mockLoadBuyerPack.mockResolvedValue([]);
});

describe('TransactionDocumentsTab — sent documents', () => {
  it('should list only SENT docs by label, grouped switches: your side open, other side collapsed', async () => {
    renderTab();
    expect(await screen.findByText('Halifax offer')).toBeInTheDocument();
    expect(screen.queryByText('Proof of Identity')).not.toBeInTheDocument(); // not sent → not listed
    expect(screen.getByRole('switch', { name: /Conveyancer — Smith & Co/ })).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByRole('switch', { name: /Seller — Sam S\./ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Other side/ }));
    expect(screen.getByRole('switch', { name: /Seller — Sam S\./ })).toBeInTheDocument();
    expect(screen.getByText(/normally goes via your conveyancer/i)).toBeInTheDocument();
    expect(screen.getByText(/^Not shared$/)).toBeInTheDocument();
  });

  it('should show a greyed lender row from the funding stage when no lender has joined', async () => {
    mockLoadBuyerPack.mockResolvedValue([{ item: 'mortgage', status: 'in_progress', detail: { funding_type: 'mortgage', lender_name: 'Nationwide' }, onLedger: false, pending: false }]);
    renderTab();
    expect(await screen.findByText(/Lender — Nationwide/)).toBeInTheDocument();
    expect(screen.getByText(/not on PropXchain/i)).toBeInTheDocument();
  });

  it('should share on toggle ON and show the history line', async () => {
    mockShareDocument.mockResolvedValue(activeGrant);
    renderTab();
    const toggle = await screen.findByRole('switch', { name: /Conveyancer — Smith & Co/ });
    fireEvent.click(toggle);
    await waitFor(() => expect(mockShareDocument).toHaveBeenCalledWith(doc, 'tx1', 'conv-p'));
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
    expect(screen.getByText(/Shared with Conveyancer — Smith & Co 3 Aug/)).toBeInTheDocument();
  });

  it('should revoke on toggle OFF and record it in the history line', async () => {
    mockListMyGrants.mockResolvedValue([activeGrant]);
    mockListGrantHistory.mockResolvedValue([activeGrant]);
    mockRevokeShare.mockResolvedValue({ auditLogged: true });
    renderTab();
    const toggle = await screen.findByRole('switch', { name: /Conveyancer — Smith & Co/ });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    await waitFor(() => expect(mockRevokeShare).toHaveBeenCalledWith(activeGrant));
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
    expect(screen.getByText(/Revoked/)).toBeInTheDocument();
  });

  it('should send a wallet doc into the deal from the picker', async () => {
    mockSend.mockResolvedValue({ itemId: 'item-2', sentAt: '2026-08-18T10:00:00Z', doc: otherDoc });
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /Add from wallet/ }));
    expect(screen.getByText('Proof of Identity')).toBeInTheDocument(); // candidate group header
    fireEvent.click(screen.getByRole('button', { name: /Send to this deal/ }));
    await waitFor(() => expect(mockSend).toHaveBeenCalledWith('tx1', otherDoc));
    expect(await screen.findAllByText(/Sent /)).toHaveLength(2);
  });

  it('should remove a doc from the deal and report revoked shares', async () => {
    mockUnsend.mockResolvedValue({ revoked: 1 });
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /Remove from deal/ }));
    await waitFor(() => expect(mockUnsend).toHaveBeenCalledWith('tx1', doc));
    expect(await screen.findByText(/sharing with 1 party was revoked/i)).toBeInTheDocument();
    expect(screen.queryByText('Halifax offer')).not.toBeInTheDocument();
  });

  it('should generate a proof QR for ticked docs and show QR views in the history line', async () => {
    const link = {
      id: 'pl-1', transactionId: 'tx1', token: 'f'.repeat(64), status: 'active' as const,
      items: [{ slotLabel: 'Mortgage Offer', hashPrefix: 'a'.repeat(12), blockchainId: 42, anchoredAt: null, verifiedAt: null }],
      expiresAt: '2099-01-01T00:00:00Z', viewCount: 2, lastViewedAt: null, createdAt: '2026-08-12T10:00:00Z',
    };
    mockCreateProof.mockResolvedValue(link);
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /Show a proof/ }));
    expect(screen.getByRole('checkbox')).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /Generate QR/ }));
    await waitFor(() => expect(mockCreateProof).toHaveBeenCalledWith('tx1', [doc]));
    expect(await screen.findByAltText('Proof QR code')).toBeInTheDocument();
    expect(screen.getByText(/app\.test\/proof\//)).toBeInTheDocument();
    expect(screen.getByText(/QR shown 12 Aug \(2 views\)/)).toBeInTheDocument();
  });

  it('should run the completion lifecycle on load and show the grace-period notice for a completed deal', async () => {
    const ends = new Date(Date.now() + 10 * 86_400_000).toISOString();
    mockLifecycle.mockResolvedValue({ isCompleted: true, accessEndsAt: ends, expiredNow: 1 });
    renderTab();
    expect(await screen.findByText(/This deal has completed/)).toBeInTheDocument();
    expect(screen.getByText(/10 days left/)).toBeInTheDocument();
    expect(screen.getByText(/1 expired share was just erased/)).toBeInTheDocument();
    expect(mockLifecycle).toHaveBeenCalledWith('tx1');
  });

  it('should show the empty state with an Add-from-wallet hint when nothing is sent', async () => {
    mockListSent.mockResolvedValue([]);
    renderTab();
    expect(await screen.findByText(/Nothing in this deal’s wallet yet/)).toBeInTheDocument();
  });

  it('should list a grant whose file is no longer in this deal with a working Revoke', async () => {
    const orphan = { ...activeGrant, id: 'g9', docHash: 'c'.repeat(64) };
    mockListMyGrants.mockResolvedValue([orphan]);
    mockRevokeShare.mockResolvedValue({ auditLogged: true });
    renderTab();
    expect(await screen.findByText(/no longer in this deal/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Revoke$/ }));
    await waitFor(() => expect(mockRevokeShare).toHaveBeenCalledWith(orphan));
  });
});
