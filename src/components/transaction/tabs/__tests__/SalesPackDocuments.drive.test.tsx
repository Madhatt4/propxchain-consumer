// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { pickFromDrive, uploadSalesPackDocument } = vi.hoisted(() => ({
  pickFromDrive: vi.fn(),
  uploadSalesPackDocument: vi.fn(),
}));

vi.mock('@/services/salesPackDocument.service', () => ({
  SALES_PACK_ACCEPTED_TYPES: ['application/pdf', 'image/jpeg', 'image/png'],
  listSalesPackDocuments: vi.fn().mockResolvedValue([]),
  uploadSalesPackDocument,
  fetchSalesPackFile: vi.fn(),
  packDownloadName: () => 'doc.pdf',
}));
vi.mock('@/services/web2-document.service', () => ({
  web2DocumentService: { getDocumentsByTransaction: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/lib/native', () => ({ isNativeApp: () => false }));
vi.mock('@/lib/googleDrivePicker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/googleDrivePicker')>()),
  pickFromDrive,
  preloadDrivePicker: vi.fn(),
}));

import { ExtraDocumentsSlot } from '../SalesPackDocuments';

const DRIVE_BUTTON = /choose from google drive/i;

function stubDriveEnv(): void {
  vi.stubEnv('VITE_GOOGLE_PICKER_API_KEY', 'api-key');
  vi.stubEnv('VITE_GOOGLE_OAUTH_CLIENT_ID', 'client-id');
  vi.stubEnv('VITE_GOOGLE_PICKER_APP_ID', '123456789');
}

function stubNoDriveEnv(): void {
  vi.stubEnv('VITE_GOOGLE_PICKER_API_KEY', '');
  vi.stubEnv('VITE_GOOGLE_OAUTH_CLIENT_ID', '');
  vi.stubEnv('VITE_GOOGLE_PICKER_APP_ID', '');
}

describe('ExtraDocumentsSlot Google Drive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadSalesPackDocument.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should not show the Drive button when the Google env vars are missing', async () => {
    stubNoDriveEnv();

    render(<ExtraDocumentsSlot transactionId="tx_1" readOnly={false} />);

    await screen.findByRole('button', { name: 'Add a document' });
    expect(screen.queryByRole('button', { name: DRIVE_BUTTON })).not.toBeInTheDocument();
  });

  it('should upload a Drive file through the same path as a chosen local file', async () => {
    stubDriveEnv();
    const file = new File(['%PDF-1.4'], 'gas.pdf', { type: 'application/pdf' });
    pickFromDrive.mockResolvedValue([file]);
    render(<ExtraDocumentsSlot transactionId="tx_1" readOnly={false} />);
    const kinds = await screen.findByRole('combobox', { name: 'Document type' });
    fireEvent.change(kinds, { target: { value: (kinds as HTMLSelectElement).options[1].value } });

    fireEvent.click(screen.getByRole('button', { name: DRIVE_BUTTON }));

    await waitFor(() => expect(uploadSalesPackDocument).toHaveBeenCalledTimes(1));
    expect(uploadSalesPackDocument.mock.calls[0][0]).toBe(file);
    expect(uploadSalesPackDocument.mock.calls[0][1]).toMatchObject({ transactionId: 'tx_1' });
  });

  it('should not show the Drive button to a read-only viewer', async () => {
    stubDriveEnv();

    render(<ExtraDocumentsSlot transactionId="tx_1" readOnly />);

    await screen.findByText('Other documents');
    expect(screen.queryByRole('button', { name: DRIVE_BUTTON })).not.toBeInTheDocument();
  });
});
