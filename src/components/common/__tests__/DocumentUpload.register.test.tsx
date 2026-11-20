// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

// An upload goes straight to registration. The AI document check that used to
// run first was retired with its backend, and an upload must never wait on it.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { registerDocumentProof } = vi.hoisted(() => ({
  registerDocumentProof: vi.fn(),
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

import DocumentUpload from '../DocumentUpload';

function chooseFile(container: HTMLElement, file: File): void {
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error('file input not rendered');
  fireEvent.change(input, { target: { files: [file] } });
}

function renderUpload(): HTMLElement {
  const { container } = render(
    <DocumentUpload
      transactionId="tx_1"
      propertyId={1}
      documentType="titleDeeds"
      documentName="Title Deeds"
      required
      onUpload={vi.fn()}
    />,
  );
  return container;
}

describe('DocumentUpload registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The rest of the registration flow is not under test: stop it here.
    registerDocumentProof.mockRejectedValue(new Error('stop after the proof call'));
  });

  it('should register the document as soon as a file is chosen', async () => {
    // Arrange
    const container = renderUpload();

    // Act
    chooseFile(container, new File(['%PDF-1.4 test'], 'title.pdf', { type: 'application/pdf' }));

    // Assert
    await waitFor(() => expect(registerDocumentProof).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/analy[sz]ing/i)).not.toBeInTheDocument();
  });

  it('should reject a file type it cannot store without registering anything', async () => {
    // Arrange
    const container = renderUpload();

    // Act
    chooseFile(container, new File(['x'], 'notes.txt', { type: 'text/plain' }));

    // Assert
    expect(await screen.findByText('Please upload a PDF, JPG, or PNG file')).toBeInTheDocument();
    expect(registerDocumentProof).not.toHaveBeenCalled();
  });
});
