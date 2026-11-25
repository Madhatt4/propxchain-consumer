// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const { pickFromDrive, transcribeEnquiries } = vi.hoisted(() => ({
  pickFromDrive: vi.fn(),
  transcribeEnquiries: vi.fn(),
}));

vi.mock('@/services/enquiries.service', async () => ({
  ...(await vi.importActual<typeof import('@/services/enquiries.service')>('@/services/enquiries.service')),
  transcribeEnquiries,
  fileToBase64: () => Promise.resolve('JVBERi0='),
}));
vi.mock('@/lib/native', () => ({ isNativeApp: () => false }));
vi.mock('@/lib/googleDrivePicker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/googleDrivePicker')>()),
  pickFromDrive,
  preloadDrivePicker: vi.fn(),
}));

import { EnquiryUpload } from '../EnquiryUpload';
import { DRIVE_PDF_ONLY_MIME_TYPES } from '@/lib/googleDrivePicker';

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

describe('EnquiryUpload Google Drive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transcribeEnquiries.mockResolvedValue({
      drafts: [{ category: 'title', question: 'Q1' }],
      dropped: 0,
      sourceDocumentId: null,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should not show the Drive button when the Google env vars are missing', () => {
    stubNoDriveEnv();

    render(<EnquiryUpload transactionId="tx_1" onRaised={vi.fn()} />);

    expect(screen.queryByRole('button', { name: DRIVE_BUTTON })).not.toBeInTheDocument();
  });

  it('should transcribe a Drive PDF through the same path as a chosen local file', async () => {
    stubDriveEnv();
    pickFromDrive.mockResolvedValue([new File(['%PDF'], 'enq.pdf', { type: 'application/pdf' })]);
    render(<EnquiryUpload transactionId="tx_1" onRaised={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: DRIVE_BUTTON }));

    expect(await screen.findByDisplayValue('Q1')).toBeInTheDocument();
    expect(transcribeEnquiries).toHaveBeenCalledWith({
      transactionId: 'tx_1',
      pdfBase64: 'JVBERi0=',
      filename: 'enq.pdf',
    });
    expect(pickFromDrive).toHaveBeenCalledWith(expect.anything(), {
      multiple: false,
      mimeTypes: DRIVE_PDF_ONLY_MIME_TYPES,
    });
  });
});
