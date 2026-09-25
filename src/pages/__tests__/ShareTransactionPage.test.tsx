import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/components/navigation/AppTopBar', () => ({ default: () => <nav /> }));
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,QR') } }));
vi.mock('@/utils/rightmoveStorage', () => ({ getRightmoveData: () => null }));
vi.mock('@/stores/authStore', () => ({ getStorePrincipalId: () => 'me-principal' }));

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

  it('should carry the chosen invite role on the join link', async () => {
    mockGetTransactionSummary.mockResolvedValue(tx);
    renderAt('TX-7');
    await screen.findAllByText(/TX-AB12-CD34/);
    const select = screen.getByLabelText(/Who are you inviting/) as HTMLSelectElement;
    expect(select.value).toBe('estate_agent');
    await waitFor(() => expect(screen.getByRole('img', { name: /QR/i })).toBeInTheDocument());
  });

  it('should fall back to the listing, then localStorage, before giving up', async () => {
    mockGetTransactionSummary.mockResolvedValue(null);
    mockGetAllTransactions.mockResolvedValue([tx]);
    renderAt('tx-7');
    expect(await screen.findAllByText(/TX-AB12-CD34/)).not.toHaveLength(0);
  });
});
