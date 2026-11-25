// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const { pickFromDrive } = vi.hoisted(() => ({ pickFromDrive: vi.fn() }));

vi.mock('@/lib/native', () => ({ isNativeApp: () => false }));
vi.mock('@/lib/googleDrivePicker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/googleDrivePicker')>()),
  pickFromDrive,
  preloadDrivePicker: vi.fn(),
}));

import { ContractExchangeStage } from '../../../../components/transaction/flow/stages/ContractExchangeStage';
import { DRIVE_PDF_ONLY_MIME_TYPES } from '@/lib/googleDrivePicker';
import type { StageConfig } from '../../../../types/stage.types';

const DRIVE_BUTTON = /choose from google drive/i;

const stage: StageConfig = {
  id: 'seller-6',
  order: 6,
  title: 'Contract & Exchange',
  description: 'E-signatures',
  status: 'active',
  journeyRole: 'seller',
  prerequisiteStageIds: ['seller-5'],
  hasProviderMarketplace: false,
  serviceMode: 'mock',
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

describe('ContractExchangeStage Google Drive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should not show the Drive button when the Google env vars are missing', () => {
    stubNoDriveEnv();

    render(<ContractExchangeStage stage={stage} journeyRole="seller" />);

    expect(screen.queryByRole('button', { name: DRIVE_BUTTON })).not.toBeInTheDocument();
  });

  it('should take a Drive PDF as the draft contract like a chosen local file', async () => {
    stubDriveEnv();
    pickFromDrive.mockResolvedValue([new File(['%PDF-1.4'], 'contract.pdf', { type: 'application/pdf' })]);
    render(<ContractExchangeStage stage={stage} journeyRole="seller" />);

    fireEvent.click(screen.getByRole('button', { name: DRIVE_BUTTON }));

    expect(await screen.findByText('contract.pdf')).toBeInTheDocument();
    expect(pickFromDrive).toHaveBeenCalledWith(expect.anything(), {
      multiple: false,
      mimeTypes: DRIVE_PDF_ONLY_MIME_TYPES,
    });
  });

  it('should refuse a Drive file over 10 MB with the usual message', async () => {
    stubDriveEnv();
    const big = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
    pickFromDrive.mockResolvedValue([big]);
    render(<ContractExchangeStage stage={stage} journeyRole="seller" />);

    fireEvent.click(screen.getByRole('button', { name: DRIVE_BUTTON }));

    expect(await screen.findByText(/is too large/)).toBeInTheDocument();
  });
});
