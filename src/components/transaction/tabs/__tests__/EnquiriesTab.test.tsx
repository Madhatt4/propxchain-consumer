// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockList = vi.fn();
const mockParty = vi.fn();
vi.mock('@/services/enquiries.service', async () => {
  const actual = await vi.importActual<typeof import('@/services/enquiries.service')>('@/services/enquiries.service');
  return {
    ...actual,
    listEnquiries: (...a: unknown[]) => mockList(...a),
    myPartyOn: (...a: unknown[]) => mockParty(...a),
    getEnquiryAnswer: () => Promise.resolve(null),
    listEnquiryNotes: () => Promise.resolve([]),
    listEnquiryChecks: () => Promise.resolve([]),
  };
});
vi.mock('../enquiries/EnquiryComposer', () => ({ EnquiryComposer: () => <div data-testid="composer" /> }));
vi.mock('../enquiries/EnquiryUpload', () => ({ EnquiryUpload: () => <div data-testid="upload" /> }));
import { EnquiriesTab } from '../EnquiriesTab';

const ROW = {
  id: 'e1000000-0000-0000-0000-000000000001', transaction_id: 'tx_1', parent_id: null, category: 'title',
  raised_by_user_id: 'u4', raised_by_side: 'buyer', question: 'Confirm the title number.', question_hash: 'a'.repeat(64),
  status: 'raised', transcribed: false, source_document_id: null, ledger_pending: true,
  created_at: '2026-09-05T10:00:00Z', raised_at: '2026-09-05T10:00:00Z', answered_at: null, closed_at: null, updated_at: '2026-09-05T10:00:00Z',
};
const props = { transactionId: 'tx_1', locked: false, requiredTier: 'starter' as const };

describe('EnquiriesTab', () => {
  beforeEach(() => { mockList.mockReset(); mockParty.mockReset(); });

  it('a conveyancer sees the composer and the upload; a seller sees neither', async () => {
    mockList.mockResolvedValue([]);
    mockParty.mockResolvedValue({ role: 'conveyancer', side: 'buyer' });
    const { unmount } = render(<EnquiriesTab {...props} />);
    await waitFor(() => expect(screen.getByTestId('composer')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Upload a PDF of enquiries' }));
    expect(screen.getByTestId('upload')).toBeInTheDocument();
    unmount();
    mockParty.mockResolvedValue({ role: 'seller', side: 'seller' });
    render(<EnquiriesTab {...props} />);
    await waitFor(() => expect(screen.getByText(/No enquiries yet/)).toBeInTheDocument());
    expect(screen.queryByTestId('composer')).toBeNull();
  });

  it('lists enquiries with status and the audit-trail notice, and opens the detail on click', async () => {
    mockList.mockResolvedValue([ROW]);
    mockParty.mockResolvedValue({ role: 'seller', side: 'seller' });
    render(<EnquiriesTab {...props} />);
    await waitFor(() => expect(screen.getByText('Confirm the title number.')).toBeInTheDocument());
    expect(screen.getByText('Awaiting answer')).toBeInTheDocument();
    expect(screen.getByText('Not yet on the audit trail')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Confirm the title number/ }));
    await waitFor(() => expect(screen.getByTestId('enquiry-detail')).toBeInTheDocument());
  });

  it('someone who is not a party sees the explanation, not the list', async () => {
    mockList.mockResolvedValue([]);
    mockParty.mockResolvedValue(null);
    render(<EnquiriesTab {...props} />);
    await waitFor(() => expect(screen.getByText(/not a party/i)).toBeInTheDocument());
  });
});
