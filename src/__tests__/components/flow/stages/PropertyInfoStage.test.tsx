// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2026 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

/**
 * The Property Information stage must show a form as done as soon as it is
 * saved on chain, before the stage itself is submitted. Marc filled the TA6
 * online, came back to the stage, and found it unticked (2026-09-18): the
 * canister hydration only ran for a completed stage or in edit mode.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PropertyInfoStage } from '../../../../components/transaction/flow/stages/PropertyInfoStage';
import type { StageConfig } from '../../../../types/stage.types';

const mockGetTA6 = vi.fn();
const mockGetTA10 = vi.fn();
const mockGetTA7 = vi.fn();
const mockRecordFormUpload = vi.fn();
const mockUploadCompletedForm = vi.fn();
const mockGetTransaction = vi.fn();
const mockWithdrawCompletedForm = vi.fn();
vi.mock('@/services/icp.service', () => ({
  icpService: {
    getTA6: (...a: unknown[]) => mockGetTA6(...a),
    getTA10: (...a: unknown[]) => mockGetTA10(...a),
    getTA7: (...a: unknown[]) => mockGetTA7(...a),
    getTransaction: (...a: unknown[]) => mockGetTransaction(...a),
    recordFormUpload: (...a: unknown[]) => mockRecordFormUpload(...a),
    ledgerManager: { logEvent: vi.fn() },
  },
}));
vi.mock('@/services/web2-document.service', () => ({ web2DocumentService: { uploadDocument: vi.fn() } }));
vi.mock('@/services/completedFormUpload.service', () => ({
  CompletedFormRejectedError: class CompletedFormRejectedError extends Error {},
  uploadCompletedForm: (...a: unknown[]) => mockUploadCompletedForm(...a),
  withdrawCompletedForm: (...a: unknown[]) => mockWithdrawCompletedForm(...a),
}));
vi.mock('@/utils/fileHash', () => ({ sha256Hex: async () => 'hash-of-file' }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('../../../../components/explainer/ExplainerModal', () => ({ default: () => null }));
vi.mock('../../../../components/explainer/ExplainerCard', () => ({ default: () => null }));

const activeStage: StageConfig = {
  id: 'seller-3',
  order: 3,
  title: 'Property Information',
  description: 'TA6, TA10, TA7',
  status: 'active',
  journeyRole: 'seller',
  prerequisiteStageIds: [],
  hasProviderMarketplace: false,
  serviceMode: 'real-read',
};

function renderStage(): void {
  render(
    <MemoryRouter>
      <PropertyInfoStage stage={activeStage} transactionId="tx_1" tenure="freehold" />
    </MemoryRouter>,
  );
}

describe('PropertyInfoStage hydration', () => {
  beforeEach(() => {
    mockGetTA6.mockReset();
    mockGetTA10.mockReset();
    mockGetTA7.mockReset();
    mockGetTA7.mockResolvedValue(null);
    mockGetTransaction.mockReset().mockResolvedValue(null);
  });

  it('should show a form uploaded as a PDF earlier, read from the seller party flag', async () => {
    mockGetTA6.mockResolvedValue(null);
    mockGetTA10.mockResolvedValue(null);
    mockGetTransaction.mockResolvedValue({ sellers: [[{ ta6FormUploaded: true, ta10FormUploaded: false }]] });

    renderStage();

    expect(await screen.findByText('Uploaded: PDF uploaded earlier')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove upload' })).toBeInTheDocument();
    expect(screen.getAllByText('Fill form online')).toHaveLength(1);
  });

  it('should still show an online form when the summary cannot be read', async () => {
    mockGetTA6.mockResolvedValue({ section1: {} });
    mockGetTA10.mockResolvedValue(null);
    mockGetTransaction.mockRejectedValue(new Error('offline'));

    renderStage();

    expect(await screen.findByText(/Filled online/)).toBeInTheDocument();
  });

  it('should show a TA6 saved on chain as filled online on an active stage, before submission', async () => {
    mockGetTA6.mockResolvedValue({ section1: {} });
    mockGetTA10.mockResolvedValue(null);

    renderStage();

    await waitFor(() => expect(mockGetTA6).toHaveBeenCalledWith('tx_1'));
    expect(await screen.findByText(/Filled online/)).toBeInTheDocument();
    // TA10 is still owed, so the stage cannot be submitted yet.
    expect(screen.queryByText('Submit All Forms & Continue')).not.toBeInTheDocument();
  });

  it('should offer submission once every required form is saved on chain', async () => {
    mockGetTA6.mockResolvedValue({ section1: {} });
    mockGetTA10.mockResolvedValue({ rooms: [] });

    renderStage();

    expect(await screen.findByText('Submit All Forms & Continue')).toBeInTheDocument();
    expect(screen.getAllByText(/Filled online/)).toHaveLength(2);
  });

  it('should leave forms unticked when nothing is saved on chain', async () => {
    mockGetTA6.mockResolvedValue(null);
    mockGetTA10.mockResolvedValue(null);

    renderStage();

    await waitFor(() => expect(mockGetTA10).toHaveBeenCalled());
    expect(screen.queryByText(/Filled online/)).not.toBeInTheDocument();
    expect(screen.getAllByText('Fill form online')).toHaveLength(2);
  });
});

describe('PropertyInfoStage completed-form upload', () => {
  const pdf = new File(['pdf'], 'my-ta6.pdf', { type: 'application/pdf' });

  beforeEach(() => {
    mockGetTA6.mockReset().mockResolvedValue(null);
    mockGetTA10.mockReset().mockResolvedValue(null);
    mockGetTA7.mockReset().mockResolvedValue(null);
    mockGetTransaction.mockReset().mockResolvedValue(null);
    mockRecordFormUpload.mockReset().mockResolvedValue(undefined);
    mockUploadCompletedForm.mockReset();
    mockWithdrawCompletedForm.mockReset().mockResolvedValue({ removed: 1 });
  });

  it('should untick the form and offer the upload again once a mistaken PDF is removed', async () => {
    mockUploadCompletedForm.mockResolvedValue({ documentId: '7', verdict: 'accepted', reason: null });
    renderStage();
    fireEvent.change(screen.getByLabelText('Upload TA6 Property Information Form'), { target: { files: [pdf] } });
    await waitFor(() => expect(screen.getByText('Uploaded: my-ta6.pdf')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Remove upload' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove it' }));

    await waitFor(() => expect(mockWithdrawCompletedForm).toHaveBeenCalledWith('tx_1', 'ta6'));
    await waitFor(() => expect(screen.queryByText('Uploaded: my-ta6.pdf')).not.toBeInTheDocument());
    expect(screen.getAllByText('Upload completed form')).toHaveLength(2);
  });

  it('should record an accepted upload on chain and show it as uploaded', async () => {
    mockUploadCompletedForm.mockResolvedValue({ documentId: '7', verdict: 'accepted', reason: null });
    renderStage();

    fireEvent.change(screen.getByLabelText('Upload TA6 Property Information Form'), { target: { files: [pdf] } });

    await waitFor(() => expect(screen.getByText('Uploaded: my-ta6.pdf')).toBeInTheDocument());
    expect(mockUploadCompletedForm).toHaveBeenCalledWith(pdf, 'tx_1', 'ta6');
    expect(mockRecordFormUpload).toHaveBeenCalledWith('tx_1', 'ta6', 'hash-of-file', 'my-ta6.pdf');
  });

  it('should record nothing and leave the form unticked when the upload is rejected', async () => {
    const { CompletedFormRejectedError } = await import('@/services/completedFormUpload.service');
    mockUploadCompletedForm.mockRejectedValue(
      new CompletedFormRejectedError('This reads as an Energy Performance Certificate, not a completed TA6 form.'),
    );
    renderStage();

    fireEvent.change(screen.getByLabelText('Upload TA6 Property Information Form'), { target: { files: [pdf] } });

    await waitFor(() => expect(mockUploadCompletedForm).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByLabelText('Upload TA6 Property Information Form')).not.toBeDisabled());
    expect(mockRecordFormUpload).not.toHaveBeenCalled();
    expect(screen.queryByText(/Uploaded: my-ta6.pdf/)).not.toBeInTheDocument();
  });

  it('should still record an upload the classifier could not verify', async () => {
    mockUploadCompletedForm.mockResolvedValue({
      documentId: '7',
      verdict: 'unverified',
      reason: "We couldn't read the text in this file.",
    });
    renderStage();

    fireEvent.change(screen.getByLabelText('Upload TA6 Property Information Form'), { target: { files: [pdf] } });

    await waitFor(() => expect(screen.getByText('Uploaded: my-ta6.pdf')).toBeInTheDocument());
    expect(mockRecordFormUpload).toHaveBeenCalledTimes(1);
  });
});
