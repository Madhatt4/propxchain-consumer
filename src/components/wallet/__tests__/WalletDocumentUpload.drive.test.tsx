// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { pickFromDrive, storeDocument } = vi.hoisted(() => ({
  pickFromDrive: vi.fn(),
  storeDocument: vi.fn(),
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/services/vaultDocument.service', () => ({
  vaultDocumentService: {
    storeDocument: (...a: unknown[]) => storeDocument(...a),
    getCustomSlotName: () => null,
  },
  validateVaultFile: (file: File) =>
    file.type === 'application/pdf' ? null : 'Please upload a PDF, JPG, or PNG file',
}));
vi.mock('@/services/transactionWallet.service', () => ({
  transactionWalletService: { removeFromWalletEverywhere: vi.fn() },
}));
vi.mock('../../../lib/native', () => ({ isNativeApp: () => false }));
vi.mock('../../../lib/googleDrivePicker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/googleDrivePicker')>()),
  pickFromDrive,
  preloadDrivePicker: vi.fn(),
}));

import { WalletDocumentUpload } from '../WalletDocumentUpload';
import { VAULT_SLOTS } from '@/types/vault.types';

const idSlot = VAULT_SLOTS.find((s) => s.id === 'proofOfId')!;
const caps = { maxFilesPerSlot: 10, maxTotalBytes: 1000 * 1024 };

function renderSlot(onStored = vi.fn()): void {
  render(
    <WalletDocumentUpload slot={idSlot} docs={[]} principal="p" caps={caps} onStored={onStored} onRemoved={vi.fn()} />,
  );
}

describe('WalletDocumentUpload from Google Drive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_GOOGLE_PICKER_API_KEY', 'api-key');
    vi.stubEnv('VITE_GOOGLE_OAUTH_CLIENT_ID', 'client-id');
    vi.stubEnv('VITE_GOOGLE_PICKER_APP_ID', '123456789');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should hand every picked Drive file to the same store path as a local file', async () => {
    const first = new File(['%PDF-1.4 a'], 'passport.pdf', { type: 'application/pdf' });
    const second = new File(['%PDF-1.4 b'], 'licence.pdf', { type: 'application/pdf' });
    pickFromDrive.mockResolvedValue([first, second]);
    storeDocument.mockImplementation(async (file: File) => ({ id: file.name }));
    const onStored = vi.fn();
    renderSlot(onStored);

    fireEvent.click(screen.getByRole('button', { name: /choose from google drive/i }));

    await waitFor(() => expect(onStored).toHaveBeenCalledTimes(2));
    expect(storeDocument.mock.calls.map((call) => call[0])).toEqual([first, second]);
    expect(pickFromDrive).toHaveBeenCalledWith(expect.anything(), { multiple: true });
  });

  it('should stop the batch and keep the validation error when a Drive file is the wrong type', async () => {
    const bad = new File(['x'], 'notes.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const good = new File(['%PDF-1.4'], 'ok.pdf', { type: 'application/pdf' });
    pickFromDrive.mockResolvedValue([bad, good]);
    renderSlot();

    fireEvent.click(screen.getByRole('button', { name: /choose from google drive/i }));

    expect(await screen.findByText('Please upload a PDF, JPG, or PNG file')).toBeInTheDocument();
    expect(storeDocument).not.toHaveBeenCalled();
  });

  it('should not show the Drive button when the slot is full', () => {
    const fullCaps = { maxFilesPerSlot: 0, maxTotalBytes: 1000 * 1024 };

    render(
      <WalletDocumentUpload slot={idSlot} docs={[]} principal="p" caps={fullCaps} onStored={vi.fn()} onRemoved={vi.fn()} />,
    );

    expect(screen.queryByRole('button', { name: /choose from google drive/i })).not.toBeInTheDocument();
  });
});
