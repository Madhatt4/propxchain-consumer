// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockCheck = vi.fn();
const mockRaise = vi.fn();
vi.mock('@/services/enquiries.service', async () => {
  const actual = await vi.importActual<typeof import('@/services/enquiries.service')>('@/services/enquiries.service');
  return { ...actual, checkEnquiry: (...a: unknown[]) => mockCheck(...a), raiseEnquiry: (...a: unknown[]) => mockRaise(...a) };
});
import { EnquiryComposer } from '../EnquiryComposer';
import { EnquiryError } from '@/services/enquiries.service';

const covered = { kind: 'ta6', ref: 'ta6.5.4', label: 'TA6 5.4 Breaches of planning or building control', quote: 'no completion certificate' };
const check = (result: Record<string, unknown[]>) => ({ check: { id: 'c1', result: { covered: [], conflicts: [], missing: [], ...result } }, reused: false, dropped: 0 });

describe('EnquiryComposer', () => {
  beforeEach(() => { mockCheck.mockReset(); mockRaise.mockReset(); });

  it('checks the draft first; when the pack already covers it, asks before raising', async () => {
    mockCheck.mockResolvedValue(check({ covered: [covered] }));
    const onRaised = vi.fn();
    render(<EnquiryComposer transactionId="tx_1" onRaised={onRaised} />);
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'ta6_alterations' } });
    fireEvent.change(screen.getByLabelText('Enquiry'), { target: { value: 'Was building regs approval obtained?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check the pack' }));
    await waitFor(() => expect(screen.getByText(/already covers this/i)).toBeInTheDocument());
    expect(screen.getByText('no completion certificate')).toBeInTheDocument();
    expect(mockRaise).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Raise anyway' }));
    await waitFor(() => expect(mockRaise).toHaveBeenCalledWith({ transactionId: 'tx_1', category: 'ta6_alterations', question: 'Was building regs approval obtained?' }));
  });

  it('raises straight away when nothing covers it', async () => {
    mockCheck.mockResolvedValue(check({ missing: [{ docType: 'completion_certificate', label: 'Completion certificate' }] }));
    mockRaise.mockResolvedValue({ id: 'e1', ledger_pending: false });
    const onRaised = vi.fn();
    render(<EnquiryComposer transactionId="tx_1" onRaised={onRaised} />);
    fireEvent.change(screen.getByLabelText('Enquiry'), { target: { value: 'Is there a completion certificate?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check the pack' }));
    await waitFor(() => expect(screen.getByText('Completion certificate')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Raise enquiry' }));
    await waitFor(() => expect(onRaised).toHaveBeenCalled());
  });

  it('a 402 from the check shows the Premium note and still allows raising', async () => {
    mockCheck.mockRejectedValue(new EnquiryError(402, 'not_entitled'));
    mockRaise.mockResolvedValue({ id: 'e1', ledger_pending: true });
    render(<EnquiryComposer transactionId="tx_1" onRaised={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Enquiry'), { target: { value: 'Q' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check the pack' }));
    await waitFor(() => expect(screen.getByText(/Premium/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Raise enquiry' }));
    await waitFor(() => expect(mockRaise).toHaveBeenCalled());
  });
});
