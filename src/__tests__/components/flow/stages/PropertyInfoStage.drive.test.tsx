// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { pickFromDrive, uploadCompletedForm } = vi.hoisted(() => ({
  pickFromDrive: vi.fn(),
  uploadCompletedForm: vi.fn(),
}));

vi.mock('@/services/icp.service', () => ({
  icpService: {
    getTA6: vi.fn().mockResolvedValue(null),
    getTA10: vi.fn().mockResolvedValue(null),
    getTA7: vi.fn().mockResolvedValue(null),
    getTransaction: vi.fn().mockResolvedValue(null),
    recordFormUpload: vi.fn().mockResolvedValue(undefined),
    ledgerManager: { logEvent: vi.fn() },
  },
}));
vi.mock('@/services/web2-document.service', () => ({ web2DocumentService: { uploadDocument: vi.fn() } }));
vi.mock('@/services/documentFindings.service', () => ({
  loadPaperworkFindings: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/services/completedFormUpload.service', () => ({
  CompletedFormRejectedError: class CompletedFormRejectedError extends Error {},
  uploadCompletedForm,
  withdrawCompletedForm: vi.fn(),
}));
vi.mock('@/utils/fileHash', () => ({ sha256Hex: async () => 'hash-of-file' }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('../../../../components/explainer/ExplainerModal', () => ({ default: () => null }));
vi.mock('../../../../components/explainer/ExplainerCard', () => ({ default: () => null }));
vi.mock('@/lib/native', () => ({ isNativeApp: () => false }));
vi.mock('@/lib/googleDrivePicker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/googleDrivePicker')>()),
  pickFromDrive,
  preloadDrivePicker: vi.fn(),
}));

import { PropertyInfoStage } from '../../../../components/transaction/flow/stages/PropertyInfoStage';
import type { StageConfig } from '../../../../types/stage.types';

const DRIVE_BUTTON = /choose from google drive/i;

const stage: StageConfig = {
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

function renderStage(): void {
  render(
    <MemoryRouter>
      <PropertyInfoStage stage={stage} transactionId="tx_1" tenure="freehold" />
    </MemoryRouter>,
  );
}

describe('PropertyInfoStage Google Drive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadCompletedForm.mockResolvedValue({ verdict: 'accepted', check: 'Checked', findings: [] });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should not show the Drive button when the Google env vars are missing', async () => {
    stubNoDriveEnv();

    renderStage();

    await screen.findAllByText('Upload completed form');
    expect(screen.queryByRole('button', { name: DRIVE_BUTTON })).not.toBeInTheDocument();
  });

  it('should send a Drive file through the same completed-form upload as a local file', async () => {
    stubDriveEnv();
    const file = new File(['%PDF-1.4'], 'ta6.pdf', { type: 'application/pdf' });
    pickFromDrive.mockResolvedValue([file]);
    renderStage();

    fireEvent.click((await screen.findAllByRole('button', { name: DRIVE_BUTTON }))[0]);

    await waitFor(() => expect(uploadCompletedForm).toHaveBeenCalledTimes(1));
    expect(uploadCompletedForm).toHaveBeenCalledWith(file, 'tx_1', 'ta6');
  });
});
