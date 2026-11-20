import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/components/navigation/AppTopBar', () => ({ default: () => <nav /> }));
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,QR') } }));
vi.mock('@/utils/rightmoveStorage', () => ({ getRightmoveData: () => null }));
vi.mock('@/stores/authStore', () => ({ getStorePrincipalId: () => 'me-principal' }));
const mockInviteState = vi.fn(() => 'share');
vi.mock('@/hooks/useBuyerInviteState', () => ({ useBuyerInviteState: () => mockInviteState() }));

const mockGetTransactionSummary = vi.fn();
const mockGetAllTransactions = vi.fn();
vi.mock('../../services/icp.service', () => ({
  icpService: {
    initialize: vi.fn(async () => undefined),
    getTransactionSummary: (...a: unknown[]) => mockGetTransactionSummary(...a),
    getAllTransactions: (...a: unknown[]) => mockGetAllTransactions(...a),
  },
}));

import ShareTransactionPage from '../ShareTransactionPage';

const tx = {
  id: 'TX-7',
  inviteCode: 'TX-AB12-CD34',
  propertyAddress: '1 Test Street',
  seller: 'me-principal',
  buyer: null,
  parties: [],
  mode: 'consumer',
};

function renderAt(id: string): void {
  render(
    <MemoryRouter initialEntries={[`/transaction/${id}/share`]}>
      <Routes>
        <Route path="/transaction/:id/share" element={<ShareTransactionPage />} />
        <Route path="/dashboard" element={<div>DASH</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.alert = vi.fn();
  mockInviteState.mockReturnValue('share');
  mockGetAllTransactions.mockResolvedValue([]); // non-admin: the admin listing is empty
});

describe('ShareTransactionPage', () => {
  it('should load the deal directly (not via the admin listing) and show its invite code', async () => {
    mockGetTransactionSummary.mockResolvedValue(tx);
    renderAt('TX-7');
    expect(await screen.findAllByText(/TX-AB12-CD34/)).not.toHaveLength(0);
    expect(mockGetTransactionSummary).toHaveBeenCalledWith('TX-7');
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('should offer the code to the buyer only, with no role picker', async () => {
    mockGetTransactionSummary.mockResolvedValue(tx);
    renderAt('TX-7');
    await screen.findAllByText(/TX-AB12-CD34/);
    expect(screen.queryByLabelText(/Who are you inviting/)).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Invite your buyer' })).toBeInTheDocument();
    expect(screen.getByTestId('buyer-only-note')).toHaveTextContent(/for your buyer only/);
    expect(screen.getByRole('link', { name: 'deal page' })).toHaveAttribute('href', '/transaction/TX-7/flow');
    await waitFor(() => expect(screen.getByRole('img', { name: /QR/i })).toBeInTheDocument());
  });

  it('should mark the join link as a buyer invite', async () => {
    mockGetTransactionSummary.mockResolvedValue(tx);
    renderAt('TX-7');
    await screen.findAllByText(/TX-AB12-CD34/);
    fireEvent.click(screen.getByRole('button', { name: 'Share Invite Link' }));
    expect(screen.getByText(/\/join\/TX-AB12-CD34\?role=buyer&side=buyer&by=me-principal/)).toBeInTheDocument();
  });

  it('should show a short line instead of the code when the buyer has already joined', async () => {
    mockInviteState.mockReturnValue('buyerJoined');
    mockGetTransactionSummary.mockResolvedValue(tx);
    renderAt('TX-7');
    expect(await screen.findByTestId('buyer-invite-unavailable')).toHaveTextContent(/already joined/);
    expect(screen.queryByText(/TX-AB12-CD34/)).toBeNull();
    expect(screen.queryByRole('img', { name: /QR/i })).toBeNull();
  });

  it('should not show the code to the buyer', async () => {
    mockInviteState.mockReturnValue('notSellerSide');
    mockGetTransactionSummary.mockResolvedValue({ ...tx, buyer: 'me-principal', seller: 'someone-else' });
    renderAt('TX-7');
    expect(await screen.findByTestId('buyer-invite-unavailable')).toHaveTextContent(/for the seller side/);
    expect(screen.queryByText(/TX-AB12-CD34/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Share via Email/ })).toBeNull();
  });

  it('should fall back to the listing, then localStorage, before giving up', async () => {
    mockGetTransactionSummary.mockResolvedValue(null);
    mockGetAllTransactions.mockResolvedValue([tx]);
    renderAt('tx-7');
    expect(await screen.findAllByText(/TX-AB12-CD34/)).not.toHaveLength(0);
  });
});
