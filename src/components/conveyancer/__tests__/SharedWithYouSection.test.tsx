import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockRpc = vi.fn();
const mockDownload = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => mockRpc(...a),
    storage: { from: () => ({ download: mockDownload }) },
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { SharedWithYouSection } from '../SharedWithYouSection';

const row = {
  transaction_id: 'tx1',
  doc_hash: 'a'.repeat(64),
  slot_id: 'mortgageOffer',
  object_path: 'shared/tx1/uid-1/mortgageOffer-aaaaaaaaaaaa.pdf',
  created_at: '2026-07-16T10:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  window.URL.createObjectURL = vi.fn(() => 'blob:url');
  window.URL.revokeObjectURL = vi.fn();
});

describe('SharedWithYouSection', () => {
  it('should list shared docs with the generic slot label', async () => {
    mockRpc.mockResolvedValue({ data: [row], error: null });
    render(<SharedWithYouSection transactionId="tx1" />);
    expect(await screen.findByText('Mortgage Offer')).toBeInTheDocument();
    expect(mockRpc).toHaveBeenCalledWith('get_my_shared_docs', { p_transaction_id: 'tx1' });
  });

  it('should show the access-ends countdown when the deal has completed', async () => {
    const expires = new Date(Date.now() + 5 * 86_400_000).toISOString();
    mockRpc.mockResolvedValue({ data: [{ ...row, expires_at: expires }], error: null });
    render(<SharedWithYouSection transactionId="tx1" />);
    expect(await screen.findByText(/access ends .*5 days left.*download your copy/)).toBeInTheDocument();
  });

  it('should download the file when Download is clicked', async () => {
    mockRpc.mockResolvedValue({ data: [row], error: null });
    mockDownload.mockResolvedValue({ data: new Blob(['x']), error: null });
    render(<SharedWithYouSection transactionId="tx1" />);
    fireEvent.click(await screen.findByRole('button', { name: /download/i }));
    await waitFor(() => expect(mockDownload).toHaveBeenCalledWith(row.object_path));
  });

  it('should render the empty state when nothing is shared', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    render(<SharedWithYouSection transactionId="tx1" />);
    expect(await screen.findByText(/no documents have been shared/i)).toBeInTheDocument();
  });

  it('should show an error state when access was revoked mid-session', async () => {
    mockRpc.mockResolvedValue({ data: [row], error: null });
    mockDownload.mockResolvedValue({ data: null, error: { message: 'Object not found' } });
    render(<SharedWithYouSection transactionId="tx1" />);
    fireEvent.click(await screen.findByRole('button', { name: /download/i }));
    expect(await screen.findByText(/no longer available/i)).toBeInTheDocument();
  });
});
