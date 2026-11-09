// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockRpc = vi.fn();
const mockDownload = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => mockRpc(...a),
    storage: { from: () => ({ download: (...a: unknown[]) => mockDownload(...a) }) },
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
  object_path: 'shared/tx1/uid-2/mortgageOffer-aaaaaaaaaaaa.pdf',
  created_at: '2026-11-09T10:00:00Z',
  expires_at: null,
};
const customRow = {
  ...row,
  doc_hash: 'b'.repeat(64),
  slot_id: 'custom1',
  object_path: 'shared/tx1/uid-2/custom1-bbbbbbbbbbbb.pdf',
};

const createObjectURL = vi.fn((_b: Blob) => 'blob:x');
const revokeObjectURL = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(window.URL, { createObjectURL, revokeObjectURL });
  mockRpc.mockResolvedValue({ data: [row, customRow], error: null });
});

describe('SharedWithYouSection', () => {
  it('should list documents shared with me on this deal by generic slot label', async () => {
    render(<SharedWithYouSection transactionId="tx1" />);
    expect(await screen.findByText('Mortgage Offer')).toBeInTheDocument();
    expect(screen.getByText('Custom document')).toBeInTheDocument();
    expect(mockRpc).toHaveBeenCalledWith('get_my_shared_docs', { p_transaction_id: 'tx1' });
  });

  it('should download the shared object from storage when Download is clicked', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    mockDownload.mockResolvedValue({ data: new Blob(['pdf']), error: null });
    render(<SharedWithYouSection transactionId="tx1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Download Mortgage Offer' }));
    await waitFor(() => expect(mockDownload).toHaveBeenCalledWith(row.object_path));
    await waitFor(() => expect(clickSpy).toHaveBeenCalled());
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
    clickSpy.mockRestore();
  });

  it('should show a message when the download fails, e.g. after a revoke', async () => {
    mockDownload.mockResolvedValue({ data: null, error: { message: 'Object not found' } });
    render(<SharedWithYouSection transactionId="tx1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Download Mortgage Offer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/no longer available/i);
  });

  it('should show the empty state when nothing has been shared', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    render(<SharedWithYouSection transactionId="tx1" />);
    expect(await screen.findByText(/Nobody has shared a personal document/)).toBeInTheDocument();
  });

  it('should show an error when the listing fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    render(<SharedWithYouSection transactionId="tx1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not load/);
  });
});
