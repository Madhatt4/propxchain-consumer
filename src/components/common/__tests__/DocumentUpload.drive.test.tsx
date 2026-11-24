// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { registerDocumentProof, pickFromDrive } = vi.hoisted(() => ({
  registerDocumentProof: vi.fn(),
  pickFromDrive: vi.fn(),
}));

vi.mock('../../../services/icp.service', () => ({
  icpService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getUserPrincipal: vi.fn().mockResolvedValue('aaaaa-aa'),
    ensureDocumentStorageActor: vi.fn().mockResolvedValue(undefined),
    getDocumentStorageCsrfToken: vi.fn().mockResolvedValue('csrf-token'),
    documentStorageActor: { registerDocumentProof: (...args: unknown[]) => registerDocumentProof(...args) },
  },
}));
vi.mock('../../../utils/hashGenerator', () => ({
  generateFileHash: vi.fn().mockResolvedValue('ab'.repeat(32)),
}));
vi.mock('../../../services/localDocumentRegistry', () => ({
  localDocumentRegistry: new Proxy({}, { get: () => vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock('@/utils/documentCleanup', () => ({ cleanupDocumentState: vi.fn() }));
vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../ScanButton', () => ({ default: () => null }));
vi.mock('../../../lib/native', () => ({ isNativeApp: () => false }));
vi.mock('../../../lib/googleDrivePicker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/googleDrivePicker')>()),
  pickFromDrive,
  preloadDrivePicker: vi.fn(),
}));

import DocumentUpload from '../DocumentUpload';

function renderUpload(): void {
  render(
    <DocumentUpload
      transactionId="tx_1"
      propertyId={1}
      documentType="epc"
      documentName="EPC"
      required
      onUpload={vi.fn()}
    />,
  );
}

function driveButton(): HTMLElement {
  return screen.getByRole('button', { name: /choose from google drive/i });
}

describe('DocumentUpload from Google Drive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerDocumentProof.mockRejectedValue(new Error('stop after the proof call'));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should not show the Drive button when the Google env vars are missing', () => {
    vi.stubEnv('VITE_GOOGLE_PICKER_API_KEY', '');
    vi.stubEnv('VITE_GOOGLE_OAUTH_CLIENT_ID', '');
    vi.stubEnv('VITE_GOOGLE_PICKER_APP_ID', '');

    renderUpload();

    expect(screen.queryByRole('button', { name: /choose from google drive/i })).not.toBeInTheDocument();
  });

  describe('with the Google env vars set', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_GOOGLE_PICKER_API_KEY', 'api-key');
      vi.stubEnv('VITE_GOOGLE_OAUTH_CLIENT_ID', 'client-id');
      vi.stubEnv('VITE_GOOGLE_PICKER_APP_ID', '123456789');
    });

    it('should register a Drive file through the same path as a chosen local file', async () => {
      const file = new File(['%PDF-1.4 epc'], 'EPC.pdf', { type: 'application/pdf' });
      pickFromDrive.mockResolvedValue([file]);
      renderUpload();

      fireEvent.click(driveButton());

      await waitFor(() => expect(registerDocumentProof).toHaveBeenCalledTimes(1));
      const [, hash, size, contentType] = registerDocumentProof.mock.calls[0];
      expect(hash).toBe('ab'.repeat(32));
      expect(size).toBe(BigInt(file.size));
      expect(contentType).toBe('application/pdf');
      expect(pickFromDrive).toHaveBeenCalledWith(expect.anything(), { multiple: false });
    });

    it('should reject a Drive file of an unsupported type with the usual message', async () => {
      pickFromDrive.mockResolvedValue([new File(['x'], 'notes.txt', { type: 'text/plain' })]);
      renderUpload();

      fireEvent.click(driveButton());

      expect(await screen.findByText('Please upload a PDF, JPG, or PNG file')).toBeInTheDocument();
      expect(registerDocumentProof).not.toHaveBeenCalled();
    });
  });
});
