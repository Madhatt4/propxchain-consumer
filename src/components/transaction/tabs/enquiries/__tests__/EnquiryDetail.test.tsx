// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The client's view of an enquiry (agent CRM spec I1): the plain-English line
 * under the question, and the notes box read as "tell your conveyancer".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getEnquiryAnswer: vi.fn(async () => null),
  listEnquiryNotes: vi.fn(async (): Promise<Record<string, unknown>[]> => []),
  listEnquiryChecks: vi.fn(async () => []),
  getEnquiryExplanation: vi.fn(async (): Promise<{ enquiry_id: string; plain_english: string; model: string; created_at: string } | null> => null),
  explainEnquiry: vi.fn(async () => ({ plain_english: 'Fresh line.', model: 'm' })),
  addEnquiryNote: vi.fn(),
  confirmEnquiryNote: vi.fn(),
}));

vi.mock('@/services/enquiries.service', () => {
  class EnquiryError extends Error {
    constructor(public readonly status: number, public readonly code: string, public readonly reason?: string) {
      super(code);
    }
  }
  return {
    EnquiryError,
    ...mocks,
    answerEnquiry: vi.fn(),
    checkEnquiry: vi.fn(),
    closeEnquiry: vi.fn(),
    withdrawEnquiry: vi.fn(),
  };
});
vi.mock('../EvidencePicker', () => ({ EvidencePicker: () => null }));
const mockRecord = vi.fn(async (..._args: unknown[]) => true);
vi.mock('@/services/onBehalf', () => ({ recordOnBehalf: (...args: unknown[]) => mockRecord(...args) }));
vi.mock('../CheckResultView', () => ({ CheckResultView: () => null }));

import { EnquiryDetail } from '../EnquiryDetail';
import type { Enquiry, MyParty } from '@/services/enquiries.service';

const ENQUIRY = {
  id: 'e1', transaction_id: 'tx_1', parent_id: null, category: 'ta6_alterations', raised_by_user_id: 'u4', raised_by_side: 'buyer',
  question: 'Was consent obtained?', question_hash: 'h', status: 'raised', transcribed: false, source_document_id: null, ledger_pending: false,
  created_at: '', raised_at: '', answered_at: null, closed_at: null, updated_at: '',
} as unknown as Enquiry;

function renderFor(party: MyParty): void {
  render(<EnquiryDetail enquiry={ENQUIRY} party={party} onChanged={vi.fn()} />);
}

describe('EnquiryDetail for a client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getEnquiryExplanation.mockResolvedValue(null);
    mocks.explainEnquiry.mockResolvedValue({ plain_english: 'Fresh line.', model: 'm' });
  });

  it('shows the cached plain-English line under the question and the "tell your conveyancer" box', async () => {
    mocks.getEnquiryExplanation.mockResolvedValue({ enquiry_id: 'e1', plain_english: 'Your buyer wants to know if the loft had consent.', model: 'm', created_at: 'x' });
    renderFor({ role: 'seller', side: 'seller' } as MyParty);
    expect(await screen.findByTestId('plain-english')).toHaveTextContent('In plain English: Your buyer wants to know if the loft had consent.');
    expect(mocks.explainEnquiry).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Tell your conveyancer' })).toBeInTheDocument();
    expect(screen.getByText(/nothing goes to the other side from you/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send to my conveyancer' })).toBeDisabled();
  });

  it('asks the platform for the line once when the cache has none, and saves what the client knows as a note', async () => {
    mocks.addEnquiryNote.mockResolvedValue({ id: 'n1', enquiry_id: 'e1', side: 'seller', body: 'The loft was done in 2015 with consent.', evidence: [], created_at: 'x', pending_confirmation: false, drafted_for_user_id: null, confirmed_at: null });
    renderFor({ role: 'seller', side: 'seller' } as MyParty);
    expect(await screen.findByTestId('plain-english')).toHaveTextContent('Fresh line.');
    expect(mocks.explainEnquiry).toHaveBeenCalledWith('e1');
    fireEvent.change(screen.getByLabelText('Tell your conveyancer'), { target: { value: 'The loft was done in 2015 with consent.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send to my conveyancer' }));
    await waitFor(() => expect(mocks.addEnquiryNote).toHaveBeenCalledWith({ enquiryId: 'e1', body: 'The loft was done in 2015 with consent.' }));
    expect(await screen.findByText('The loft was done in 2015 with consent.')).toBeInTheDocument();
  });

  it('says nothing when no line can be had, rather than a broken box', async () => {
    mocks.explainEnquiry.mockRejectedValue(new Error('502'));
    renderFor({ role: 'buyer', side: 'buyer' } as MyParty);
    await waitFor(() => expect(mocks.explainEnquiry).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('plain-english')).toBeNull());
  });

  it("keeps the conveyancer's wording: notes stay 'Notes (your side only)' with 'Add note'", async () => {
    mocks.getEnquiryExplanation.mockResolvedValue({ enquiry_id: 'e1', plain_english: 'Line.', model: 'm', created_at: 'x' });
    renderFor({ role: 'conveyancer', side: 'buyer' } as MyParty);
    expect(await screen.findByTestId('plain-english')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Notes (your side only)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add note' })).toBeInTheDocument();
    expect(screen.queryByText(/nothing goes to the other side/i)).toBeNull();
  });
});

describe('EnquiryDetail on an assisted deal (agent CRM 7b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getEnquiryExplanation.mockResolvedValue({ enquiry_id: 'e1', plain_english: 'Line.', model: 'm', created_at: 'x' });
  });

  it("the agent drafts what the seller knows; it waits for the seller and goes on the trail in the seller's name", async () => {
    mocks.addEnquiryNote.mockResolvedValue({ id: 'n2', enquiry_id: 'e1', side: 'seller', body: 'Signed off in 2019.', evidence: [], created_at: 'x', pending_confirmation: true, drafted_for_user_id: 'u1', confirmed_at: null });
    renderFor({ role: 'estate_agent', side: 'seller' } as MyParty);
    await screen.findByTestId('plain-english');
    expect(screen.getByRole('heading', { name: 'Draft what the seller knows' })).toBeInTheDocument();
    expect(screen.getByText(/waits for them to confirm/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Draft for the client'), { target: { value: 'Signed off in 2019.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save for the seller to confirm' }));
    await waitFor(() => expect(mocks.addEnquiryNote).toHaveBeenCalledWith({ enquiryId: 'e1', body: 'Signed off in 2019.' }));
    expect(await screen.findByTestId('pending-note')).toHaveTextContent('Waiting for the seller to confirm');
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
    await waitFor(() => expect(mockRecord).toHaveBeenCalledWith('tx_1', 'seller', 'draft_enquiry_note', 'n2'));
  });

  it("the seller sees the agent's draft and makes it theirs with one tap", async () => {
    mocks.listEnquiryNotes.mockResolvedValue([{ id: 'n2', enquiry_id: 'e1', side: 'seller', body: 'Signed off in 2019.', evidence: [], created_at: 'x', pending_confirmation: true, drafted_for_user_id: 'u1', confirmed_at: null }]);
    mocks.confirmEnquiryNote.mockResolvedValue({ id: 'n2', enquiry_id: 'e1', side: 'seller', body: 'Signed off in 2019.', evidence: [], created_at: 'x', pending_confirmation: false, drafted_for_user_id: 'u1', confirmed_at: 'y' });
    renderFor({ role: 'seller', side: 'seller' } as MyParty);
    expect(await screen.findByTestId('pending-note')).toHaveTextContent('Your agent drafted this. Confirm to send it to your conveyancer.');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(mocks.confirmEnquiryNote).toHaveBeenCalledWith('n2'));
    await waitFor(() => expect(screen.queryByTestId('pending-note')).toBeNull());
    expect(screen.getByText('Signed off in 2019.')).toBeInTheDocument();
    expect(mockRecord).not.toHaveBeenCalled();
  });
});
