// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The pack's "other documents": listed from the deal for every party, with
 * this browser's older IndexedDB copies still shown and marked as local.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const listSalesPackDocuments = vi.fn();
const uploadSalesPackDocument = vi.fn();
const fetchSalesPackFile = vi.fn();
const getLocalDocuments = vi.fn();

vi.mock('@/services/salesPackDocument.service', () => ({
  SALES_PACK_ACCEPTED_TYPES: ['application/pdf', 'image/jpeg', 'image/png'],
  listSalesPackDocuments: (...a: unknown[]) => listSalesPackDocuments(...a),
  uploadSalesPackDocument: (...a: unknown[]) => uploadSalesPackDocument(...a),
  fetchSalesPackFile: (...a: unknown[]) => fetchSalesPackFile(...a),
  packDownloadName: () => 'Floor-plan-abcdef12.pdf',
}));
vi.mock('@/services/web2-document.service', () => ({
  web2DocumentService: { getDocumentsByTransaction: (...a: unknown[]) => getLocalDocuments(...a) },
}));

import { ExtraDocumentsSlot } from '../SalesPackDocuments';

const FLOOR_PLAN = {
  id: 'doc_3',
  kind: 'sales_pack_floor_plan',
  label: 'Floor plan',
  fileName: 'sales_pack_floor_plan.pdf',
  uploadedAt: '2026-11-09T10:00:00.000Z',
  storageLocation: 'supabase://propxchain-documents/transactions/tx_5/sales-pack/x.pdf',
  fileHash: 'abcdef1234',
  contentType: 'application/pdf',
};

describe('ExtraDocumentsSlot for the buyer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLocalDocuments.mockResolvedValue([]);
  });

  it("should list the seller's pack documents with type, name, date and an open link", async () => {
    listSalesPackDocuments.mockResolvedValue([FLOOR_PLAN]);

    render(<ExtraDocumentsSlot transactionId="tx_5" readOnly />);

    const list = await screen.findByRole('list', { name: 'Sales pack documents' });
    expect(list).toHaveTextContent('Floor plan');
    expect(list).toHaveTextContent('sales_pack_floor_plan.pdf');
    expect(list).toHaveTextContent('9 Nov 2026');
    expect(screen.getByRole('button', { name: 'Open Floor plan' })).toBeInTheDocument();
    expect(listSalesPackDocuments).toHaveBeenCalledWith('tx_5');
    expect(screen.queryByRole('button', { name: 'Add a document' })).toBeNull();
  });

  it('should say nothing has been added when the deal has no pack documents', async () => {
    listSalesPackDocuments.mockResolvedValue([]);

    render(<ExtraDocumentsSlot transactionId="tx_5" readOnly />);

    expect(await screen.findByText('Nothing added yet.')).toBeInTheDocument();
  });

  it('should say the list could not load rather than that nothing was added', async () => {
    listSalesPackDocuments.mockRejectedValue(new Error('canister down'));

    render(<ExtraDocumentsSlot transactionId="tx_5" readOnly />);

    expect(await screen.findByText(/Couldn't load the pack documents/)).toBeInTheDocument();
    expect(screen.queryByText('Nothing added yet.')).toBeNull();
  });

  it('should defer revoking the download URL so the browser can start the download', async () => {
    listSalesPackDocuments.mockResolvedValue([FLOOR_PLAN]);
    fetchSalesPackFile.mockResolvedValue(new Blob(['x'], { type: 'application/pdf' }));
    const create = vi.fn(() => 'blob:pack');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const timeout = vi.spyOn(globalThis, 'setTimeout');

    render(<ExtraDocumentsSlot transactionId="tx_5" readOnly />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open Floor plan' }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(revoke).not.toHaveBeenCalled();
    // findByRole/waitFor schedule their own 1s timers; the revoke delay is longer.
    const deferred = timeout.mock.calls.find(([, ms]) => typeof ms === 'number' && ms >= 5000);
    expect(deferred).toBeDefined();
    (deferred?.[0] as () => void)();
    expect(revoke).toHaveBeenCalledWith('blob:pack');
    timeout.mockRestore();
  });

  it('should show the reason when a file cannot be opened', async () => {
    listSalesPackDocuments.mockResolvedValue([FLOOR_PLAN]);
    fetchSalesPackFile.mockRejectedValue(new Error("This file can't be opened from your account yet."));

    render(<ExtraDocumentsSlot transactionId="tx_5" readOnly />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open Floor plan' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("can't be opened from your account");
  });
});

describe('ExtraDocumentsSlot for the seller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listSalesPackDocuments.mockResolvedValue([]);
  });

  it('should keep showing documents added on this device before, marked as local only', async () => {
    getLocalDocuments.mockResolvedValue([
      { id: 'local-1', transactionId: 'tx_5', documentType: 'sales_pack_gas_safety', fileName: 'gas.pdf', fileData: new ArrayBuffer(1), contentType: 'application/pdf', uploadedAt: '2026-10-01' },
      { id: 'local-2', transactionId: 'tx_5', documentType: 'ta6', fileName: 'ta6.pdf', fileData: new ArrayBuffer(1), contentType: 'application/pdf', uploadedAt: '2026-10-01' },
    ]);

    render(<ExtraDocumentsSlot transactionId="tx_5" readOnly={false} />);

    const list = await screen.findByRole('list', { name: 'Sales pack documents' });
    expect(list).toHaveTextContent('Gas safety certificate');
    expect(list).toHaveTextContent('On this device only');
    expect(list).not.toHaveTextContent('ta6.pdf');
  });

  it('should upload to the deal and refresh the list from the server', async () => {
    getLocalDocuments.mockResolvedValue([]);
    uploadSalesPackDocument.mockResolvedValue({});
    listSalesPackDocuments.mockResolvedValueOnce([]).mockResolvedValue([FLOOR_PLAN]);

    render(<ExtraDocumentsSlot transactionId="tx_5" readOnly={false} />);
    fireEvent.change(screen.getByLabelText('Document type'), { target: { value: 'sales_pack_floor_plan' } });
    const file = new File(['%PDF-'], 'plan.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByTestId('sales-pack-file'), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Floor plan added to the pack.'));
    expect(uploadSalesPackDocument).toHaveBeenCalledWith(file, { transactionId: 'tx_5', kind: 'sales_pack_floor_plan' });
    expect(screen.getByRole('button', { name: 'Open Floor plan' })).toBeInTheDocument();
  });

  it('should keep the earlier rows and say they may be out of date when a refresh fails', async () => {
    getLocalDocuments.mockResolvedValue([]);
    uploadSalesPackDocument.mockResolvedValue({});
    listSalesPackDocuments.mockResolvedValueOnce([FLOOR_PLAN]).mockRejectedValue(new Error('canister down'));

    render(<ExtraDocumentsSlot transactionId="tx_5" readOnly={false} />);
    await screen.findByRole('button', { name: 'Open Floor plan' });
    fireEvent.change(screen.getByLabelText('Document type'), { target: { value: 'sales_pack_epc' } });
    fireEvent.change(screen.getByTestId('sales-pack-file'), {
      target: { files: [new File(['%PDF-'], 'epc.pdf', { type: 'application/pdf' })] },
    });

    expect(await screen.findByText(/may be out of date/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Floor plan' })).toBeInTheDocument();
    expect(screen.queryByText(/Couldn't load/)).toBeNull();
    expect(screen.queryByText('Nothing added yet.')).toBeNull();
  });

  it('should show the upload error message', async () => {
    getLocalDocuments.mockResolvedValue([]);
    uploadSalesPackDocument.mockRejectedValue(new Error('Files up to 10MB only.'));

    render(<ExtraDocumentsSlot transactionId="tx_5" readOnly={false} />);
    fireEvent.change(screen.getByLabelText('Document type'), { target: { value: 'sales_pack_epc' } });
    fireEvent.change(screen.getByTestId('sales-pack-file'), {
      target: { files: [new File(['x'], 'epc.pdf', { type: 'application/pdf' })] },
    });

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Files up to 10MB only.'));
  });
});
