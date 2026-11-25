// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { pickFromDrive, uploadSurveyReport } = vi.hoisted(() => ({
  pickFromDrive: vi.fn(),
  uploadSurveyReport: vi.fn(),
}));

vi.mock('../../../services/surveyDocument.service', () => ({ uploadSurveyReport }));
vi.mock('../../../services/scan.service', () => ({
  fileToBase64: async () => 'cGRm',
  runSurveyScan: vi.fn().mockResolvedValue({ status: 'complete' }),
}));
vi.mock('../../../services/buyerPack.service', () => ({ declareBuyerPack: vi.fn().mockResolvedValue([]) }));
vi.mock('../../../utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock('@/lib/native', () => ({ isNativeApp: () => false }));
vi.mock('@/lib/googleDrivePicker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/googleDrivePicker')>()),
  pickFromDrive,
  preloadDrivePicker: vi.fn(),
}));

import { SurveyReportUpload } from '../SurveyReportUpload';
import { DRIVE_PDF_ONLY_MIME_TYPES } from '@/lib/googleDrivePicker';

const DRIVE_BUTTON = /choose from google drive/i;
const HASH = 'a'.repeat(64);

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

describe('SurveyReportUpload Google Drive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadSurveyReport.mockResolvedValue({ fileHash: HASH });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should not show the Drive button when the Google env vars are missing', () => {
    stubNoDriveEnv();

    render(<SurveyReportUpload transactionId="tx_1" />);

    expect(screen.queryByRole('button', { name: DRIVE_BUTTON })).not.toBeInTheDocument();
  });

  it('should upload a Drive PDF through the same path as a chosen local file', async () => {
    stubDriveEnv();
    const file = new File(['%PDF-1.4'], 'survey.pdf', { type: 'application/pdf' });
    pickFromDrive.mockResolvedValue([file]);
    const onUploaded = vi.fn();
    render(<SurveyReportUpload transactionId="tx_1" onUploaded={onUploaded} />);

    fireEvent.click(screen.getByRole('button', { name: DRIVE_BUTTON }));

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(HASH));
    expect(uploadSurveyReport.mock.calls[0][0]).toBe(file);
    expect(pickFromDrive).toHaveBeenCalledWith(expect.anything(), {
      multiple: false,
      mimeTypes: DRIVE_PDF_ONLY_MIME_TYPES,
    });
  });
});
