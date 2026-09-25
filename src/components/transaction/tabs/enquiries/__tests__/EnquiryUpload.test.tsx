// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockTranscribe = vi.fn();
const mockRaise = vi.fn();
vi.mock('@/services/enquiries.service', async () => {
  const actual = await vi.importActual<typeof import('@/services/enquiries.service')>('@/services/enquiries.service');
  return {
    ...actual,
    transcribeEnquiries: (...a: unknown[]) => mockTranscribe(...a),
    raiseEnquiry: (...a: unknown[]) => mockRaise(...a),
    fileToBase64: () => Promise.resolve('JVBERi0='),
  };
});
import { EnquiryUpload } from '../EnquiryUpload';

describe('EnquiryUpload', () => {
  beforeEach(() => { mockTranscribe.mockReset(); mockRaise.mockReset(); });

  it('transcribes a PDF into drafts and raises only the ticked ones', async () => {
    mockTranscribe.mockResolvedValue({ drafts: [{ category: 'title', question: 'Q1' }, { category: 'other', question: 'Q2' }], dropped: 0, sourceDocumentId: null });
    mockRaise.mockResolvedValue({ id: 'e1' });
    const onRaised = vi.fn();
    render(<EnquiryUpload transactionId="tx_1" onRaised={onRaised} />);
    const file = new File(['%PDF'], 'enq.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Enquiries PDF'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByDisplayValue('Q1')).toBeInTheDocument());
    expect(mockTranscribe).toHaveBeenCalledWith({ transactionId: 'tx_1', pdfBase64: 'JVBERi0=', filename: 'enq.pdf' });
    fireEvent.click(screen.getByLabelText('Include Q2'));   // untick the second
    fireEvent.click(screen.getByRole('button', { name: 'Raise 1 enquiry' }));
    await waitFor(() => expect(mockRaise).toHaveBeenCalledTimes(1));
    expect(mockRaise).toHaveBeenCalledWith({ transactionId: 'tx_1', category: 'title', question: 'Q1', transcribed: true });
    await waitFor(() => expect(onRaised).toHaveBeenCalled());
  });

  it('rejects a non-PDF without calling the server', async () => {
    render(<EnquiryUpload transactionId="tx_1" onRaised={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Enquiries PDF'), { target: { files: [new File(['x'], 'a.txt', { type: 'text/plain' })] } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/PDF/));
    expect(mockTranscribe).not.toHaveBeenCalled();
  });
});
