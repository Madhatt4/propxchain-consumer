// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
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
  id: 'row-1', slotId: 'proofOfId' as const, blockchainId: 42, fileHash: 'a'.repeat(64), fileSize: 1000,
  mimeType: 'application/pdf', uploadedAt: '2026-07-16T00:00:00Z', objectPath: 'wallet/uid-1/proofOfId-aaaaaaaaaaaa.pdf',
  label: 'Passport',
};
const sentItem = { itemId: 'item-1', sentAt: '2026-11-09T09:00:00Z', doc };

const buyerConv = { principal: 'bc', label: 'Conveyancer — Smith & Co', role: 'conveyancer' as const, side: 'buyer' as const };
const seller = { principal: 's', label: 'Seller — Sam S.', role: 'seller' as const, side: 'seller' as const };
const sellerConv = { principal: 'sc', label: 'Conveyancer — Jones LLP', role: 'conveyancer' as const, side: 'seller' as const };
const agent = { principal: 'ea', label: 'Estate agent — Acme Homes', role: 'estate_agent' as const, side: 'seller' as const };

const grantFor = (principal: string): Record<string, unknown> => ({
  id: `g-${principal}`, transactionId: 'tx1', docHash: doc.fileHash, slotId: 'proofOfId',
  objectPath: 'shared/tx1/uid-1/proofOfId-aaaaaaaaaaaa.pdf', granteePrincipal: principal,
  status: 'active' as const, createdAt: '2026-11-09T10:00:00Z', revokedAt: null, expiresAt: null,
});

const choose = (value: string): void => {
  fireEvent.change(screen.getByRole('combobox', { name: /Who can see this/ }), { target: { value } });
};

async function renderTab(): Promise<void> {
  render(
    <MemoryRouter>
      <TransactionDocumentsTab transactionId="tx1" />
    </MemoryRouter>,
  );
  await screen.findByText('Passport');
}

const grantees = (): string[] => mockShareDocument.mock.calls.map((c) => c[2] as string).sort();
const revokedPrincipals = (): string[] =>
  mockRevokeShare.mock.calls.map((c) => (c[0] as { granteePrincipal: string }).granteePrincipal).sort();

beforeEach(() => {
  vi.clearAllMocks();
  mockListMyDocuments.mockResolvedValue([doc]);
  mockListSent.mockResolvedValue([sentItem]);
  mockLoadRoster.mockResolvedValue({ mySide: 'buyer', parties: [buyerConv, seller, sellerConv, agent] });
  mockListMyGrants.mockResolvedValue([]);
  mockListGrantHistory.mockResolvedValue([]);
  mockListAllProofs.mockResolvedValue([]);
  mockLifecycle.mockResolvedValue({ isCompleted: false, accessEndsAt: null, expiredNow: 0 });
  mockLoadBuyerPack.mockResolvedValue([]);
  mockShareDocument.mockImplementation(async (_d: unknown, _t: string, p: string) => grantFor(p));
  mockRevokeShare.mockResolvedValue({ auditLogged: true });
});

describe('TransactionDocumentsTab — who can see this', () => {
  it('should default to Nobody and say nobody can see it', async () => {
    await renderTab();
    expect(screen.getByRole('combobox', { name: /Who can see this/ })).toHaveValue('nobody');
    expect(screen.getByText('Visible to nobody on this deal')).toBeInTheDocument();
  });

  it('should name the roles in the confirm dialog and grant nothing until confirmed', async () => {
    await renderTab();
    choose('other_side');
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Seller and Seller’s conveyancer');
    expect(dialog).not.toHaveTextContent(/Sam S\.|Jones LLP/);
    expect(mockShareDocument).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockShareDocument).not.toHaveBeenCalled();
  });

  it('should grant my conveyancer only for My conveyancer', async () => {
    await renderTab();
    choose('my_conveyancer');
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(grantees()).toEqual(['bc']));
    expect(await screen.findByText('Visible to: Buyer’s conveyancer')).toBeInTheDocument();
  });

  it('should grant the other party and their conveyancer for The other side', async () => {
    await renderTab();
    choose('other_side');
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(grantees()).toEqual(['s', 'sc']));
    expect(mockShareDocument).toHaveBeenCalledWith(doc, 'tx1', 's');
  });

  it('should grant every party for Everyone on the deal', async () => {
    await renderTab();
    choose('everyone');
    expect(screen.getByRole('dialog')).toHaveTextContent('Estate agent');
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(grantees()).toEqual(['bc', 'ea', 's', 'sc']));
  });

  it('should revoke the grants a new preset drops', async () => {
    mockListMyGrants.mockResolvedValue([grantFor('bc'), grantFor('ea')]);
    await renderTab();
    choose('other_side');
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(revokedPrincipals()).toEqual(['bc', 'ea']));
    expect(grantees()).toEqual(['s', 'sc']);
  });

  it('should revoke every grant for Nobody without asking', async () => {
    mockListMyGrants.mockResolvedValue([grantFor('bc'), grantFor('s'), grantFor('sc')]);
    await renderTab();
    expect(screen.getByText(/Visible to: Buyer’s conveyancer, Seller, Seller’s conveyancer/)).toBeInTheDocument();
    choose('nobody');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(revokedPrincipals()).toEqual(['bc', 's', 'sc']));
    expect(mockShareDocument).not.toHaveBeenCalled();
    expect(await screen.findByText('Visible to nobody on this deal')).toBeInTheDocument();
  });

  it('should also share with the seller conveyancer when the seller is switched on under Custom', async () => {
    await renderTab();
    choose('custom');
    fireEvent.click(screen.getByRole('button', { name: /Other side/ }));
    fireEvent.click(screen.getByRole('switch', { name: /Seller — Sam S\./ }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Seller and Seller’s conveyancer');
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(grantees()).toEqual(['s', 'sc']));
  });

  it('should disable side presets for a user with no side, such as the agent', async () => {
    mockLoadRoster.mockResolvedValue({ mySide: null, parties: [buyerConv, seller, sellerConv] });
    await renderTab();
    expect(screen.getByRole('option', { name: 'My conveyancer' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'The other side' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Everyone on the deal' })).not.toBeDisabled();
  });

  it('should report a failed share and stop', async () => {
    mockShareDocument.mockRejectedValue(new Error('The on-chain consent record failed'));
    await renderTab();
    choose('other_side');
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/on-chain consent record failed/);
    expect(mockShareDocument).toHaveBeenCalledTimes(1);
  });
});

describe('TransactionDocumentsTab — who can see this fails closed', () => {
  it('should revoke first, so a grant failure afterwards leaves no extra access', async () => {
    mockListMyGrants.mockResolvedValue([grantFor('bc')]);
    mockShareDocument.mockRejectedValue(new Error('The on-chain consent record failed'));
    await renderTab();
    choose('other_side');
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/on-chain consent record failed/);
    expect(revokedPrincipals()).toEqual(['bc']);
    expect(mockRevokeShare.mock.invocationCallOrder[0]).toBeLessThan(mockShareDocument.mock.invocationCallOrder[0]);
    expect(mockShareDocument).toHaveBeenCalledTimes(1);
  });

  it('should try every revoke and grant nothing when any revoke fails', async () => {
    mockListMyGrants.mockResolvedValue([grantFor('bc'), grantFor('ea')]);
    mockRevokeShare.mockImplementation(async (g: { granteePrincipal: string }) => {
      if (g.granteePrincipal === 'bc') throw new Error('network');
      return { auditLogged: true };
    });
    await renderTab();
    choose('other_side');
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not stop sharing with 1 party, so nothing new was shared/);
    expect(revokedPrincipals()).toEqual(['bc', 'ea']);
    expect(mockShareDocument).not.toHaveBeenCalled();
  });

  it('should rebuild the plan from fresh data at confirm and grant only confirmed principals', async () => {
    await renderTab();
    choose('other_side');
    expect(screen.getByRole('combobox', { name: /Who can see this/ })).toBeDisabled();
    // Between dropdown and confirm: the seller got access elsewhere and a new seller-side conveyancer joined.
    const lateConv = { principal: 'sc2', label: 'Conveyancer — Late LLP', role: 'conveyancer' as const, side: 'seller' as const };
    mockListMyGrants.mockResolvedValue([grantFor('s')]);
    mockLoadRoster.mockResolvedValue({ mySide: 'buyer', parties: [buyerConv, seller, sellerConv, lateConv, agent] });
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(grantees()).toEqual(['sc']));
    await waitFor(() => expect(screen.getByRole('combobox', { name: /Who can see this/ })).not.toBeDisabled());
    expect(mockShareDocument).not.toHaveBeenCalledWith(doc, 'tx1', 'sc2');
    expect(mockShareDocument).not.toHaveBeenCalledWith(doc, 'tx1', 's');
  });

  it('should unlock the chooser when the dialog is cancelled', async () => {
    await renderTab();
    choose('everyone');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('combobox', { name: /Who can see this/ })).not.toBeDisabled();
  });

  it('should grant only the agent for Estate agent and revoke the seller with their conveyancer', async () => {
    mockListMyGrants.mockResolvedValue([grantFor('s'), grantFor('sc')]);
    await renderTab();
    expect(screen.getByRole('combobox', { name: /Who can see this/ })).toHaveValue('other_side');
    choose('estate_agent');
    expect(screen.getByRole('dialog')).toHaveTextContent('Estate agent');
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(grantees()).toEqual(['ea']));
    expect(revokedPrincipals()).toEqual(['s', 'sc']);
  });

  it('should keep the conveyancer when the new preset still includes them', async () => {
    mockListMyGrants.mockResolvedValue([grantFor('s'), grantFor('sc')]);
    await renderTab();
    choose('everyone');
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(grantees()).toEqual(['bc', 'ea']));
    expect(mockRevokeShare).not.toHaveBeenCalled();
  });
});
