// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

// The AI document check ("Oscar") ran before every supported upload. Its
// backend was retired, so the call fails; the upload then stopped at
// "analyzing" with no way to continue, because the Proceed button only renders
// when there is a result. An upload must never wait on that check.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';

const { registerDocumentProof, analyzeDocument, supportsOscarAnalysis } = vi.hoisted(() => ({
  registerDocumentProof: vi.fn(),
  analyzeDocument: vi.fn(),
  supportsOscarAnalysis: vi.fn(),
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

vi.mock('../../../services/oscar/oscarDocumentAnalysis.service', () => ({
  oscarDocumentAnalysis: {
    supportsOscarAnalysis: (...args: unknown[]) => supportsOscarAnalysis(...args),
    analyzeDocument: (...args: unknown[]) => analyzeDocument(...args),
    registerVerificationOnChain: vi.fn().mockResolvedValue({ success: false }),
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
vi.mock('../OscarVerificationBadge', () => ({ default: () => null }));
vi.mock('../OscarAnalysisPanel', () => ({ default: () => null }));
vi.mock('../ScanButton', () => ({ default: () => null }));

import DocumentUpload from '../DocumentUpload';

function chooseFile(container: HTMLElement): void {
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error('file input not rendered');
  const file = new File(['%PDF-1.4 test'], 'title.pdf', { type: 'application/pdf' });
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

describe('DocumentUpload when the AI document check is unavailable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The rest of the registration flow is not under test: stop it here.
    registerDocumentProof.mockRejectedValue(new Error('stop after the proof call'));
  });

  it('should register the document without calling the AI check by default', async () => {
    // Arrange
    supportsOscarAnalysis.mockReturnValue(true);
    analyzeDocument.mockRejectedValue(new Error('Analysis failed: 503'));
    const container = renderUpload();

    // Act
    chooseFile(container);

    // Assert
    await waitFor(() => expect(registerDocumentProof).toHaveBeenCalledTimes(1));
    expect(analyzeDocument).not.toHaveBeenCalled();
  });

  it('should still register the document when the AI check is switched on and fails', async () => {
    // Arrange
    supportsOscarAnalysis.mockReturnValue(true);
    analyzeDocument.mockRejectedValue(new Error('Analysis failed: 503'));
    const { container } = render(
      <DocumentUpload
        transactionId="tx_1"
        propertyId={1}
        documentType="titleDeeds"
        documentName="Title Deeds"
        required
        enableOscarAnalysis
        onUpload={vi.fn()}
      />,
    );

    // Act
    chooseFile(container);

    // Assert
    await waitFor(() => expect(analyzeDocument).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(registerDocumentProof).toHaveBeenCalledTimes(1));
  });
});
