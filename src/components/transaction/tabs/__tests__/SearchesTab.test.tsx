import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const svc = vi.hoisted(() => ({
  getDealSearchOrders: vi.fn(),
  getSignOffs: vi.fn(),
  getMySignOffRole: vi.fn(),
  signOffSearches: vi.fn(),
  revokeSignOff: vi.fn(),
}));

vi.mock('@/services/searchSignOff.service', () => svc);
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { id: 'buyer-1' } } }) } },
}));

import { SearchesTab } from '../SearchesTab';

const PROPS = { transactionId: 'tx_1', locked: false, requiredTier: 'starter' as const };

describe('SearchesTab', () => {
  beforeEach(() => {
    Object.values(svc).forEach((fn) => fn.mockReset());
    svc.getSignOffs.mockResolvedValue([]);
    svc.getMySignOffRole.mockResolvedValue('buyer');
  });

  it('should list orders with their results state and offer sign-off to the buyer', async () => {
    svc.getDealSearchOrders.mockResolvedValue([
      { searchOrderId: 'o1', provider: 'onesearch', orderedAt: '2026-09-01T00:00:00Z', hasResults: true },
      { searchOrderId: 'o2', provider: 'groundsure', orderedAt: '2026-09-02T00:00:00Z', hasResults: false },
    ]);

    render(<SearchesTab {...PROPS} />);

    expect(await screen.findByText(/1 of 2 back/)).toBeInTheDocument();
    expect(screen.getByText('OneSearch')).toBeInTheDocument();
    expect(screen.getByText('Results back')).toBeInTheDocument();
    expect(screen.getByText('Awaiting results')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign off 1 search' })).toBeInTheDocument();
  });

  it('should say so when nothing has been ordered', async () => {
    svc.getDealSearchOrders.mockResolvedValue([]);

    render(<SearchesTab {...PROPS} />);

    expect(await screen.findByText(/No searches have been ordered/)).toBeInTheDocument();
  });

  it('should show the server refusal to a non-party', async () => {
    svc.getDealSearchOrders.mockRejectedValue(new Error('Could not load searches: not a party to this transaction'));

    render(<SearchesTab {...PROPS} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/not a party/);
  });
});
