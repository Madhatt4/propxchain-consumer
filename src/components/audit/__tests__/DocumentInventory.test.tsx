import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DocumentInventory from '../DocumentInventory';
import type { DocumentAuditEntry } from '../../../services/transactionAudit';

// Mock useThemeClasses
vi.mock('../../../hooks/useThemeClasses', () => ({
  useThemeClasses: () => ({
    textPrimary: 'text-primary',
    textSecondary: 'text-secondary',
    textTertiary: 'text-tertiary',
    cardPrimary: 'card-primary',
    cardSecondary: 'card-secondary',
  }),
}));

const mockVerifyDocumentHash = vi.fn();

vi.mock('../../../services/icp.service', () => ({
  icpService: {
    documentStorageActor: {
      verifyDocumentHash: (...args: unknown[]) => mockVerifyDocumentHash(...args),
    },
    // verifyDocumentHash is CSRF-protected on document_storage, so the
    // component fetches a token before calling it.
    getDocumentStorageCsrfToken: () => Promise.resolve('csrf-test-token'),
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

function makeDocument(overrides: Partial<DocumentAuditEntry> = {}): DocumentAuditEntry {
  return {
    id: 1,
    fileName: 'title-deed.pdf',
    docType: 'title_deed',
    fileHash: 'a1b2c3d4e5f67890abcdef1234567890',
    fileSize: 204800,
    uploadedAt: Date.now() * 1_000_000,
    uploadedBy: 'xyz-principal',
    verified: true,
    verificationStatus: 'verified',
    ...overrides,
  };
}

describe('DocumentInventory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyDocumentHash.mockResolvedValue(true);
  });

  it('should show "No documents uploaded yet" when empty', () => {
    render(<DocumentInventory documents={[]} />);

    expect(screen.getByText('No documents uploaded yet')).toBeInTheDocument();
  });

  it('should render document list with hashes', () => {
    const docs = [
      makeDocument({ id: 1, fileName: 'title-deed.pdf', fileHash: 'abcdef0123456789abcdef0123456789' }),
      makeDocument({ id: 2, fileName: 'search-results.pdf', fileHash: 'deadbeef0123456789deadbeef012345' }),
    ];

    render(<DocumentInventory documents={docs} />);

    expect(screen.getByText('title-deed.pdf')).toBeInTheDocument();
    expect(screen.getByText('search-results.pdf')).toBeInTheDocument();
    // Hashes are truncated: first 8 + ... + last 8
    expect(screen.getByText('abcdef01...23456789')).toBeInTheDocument();
    expect(screen.getByText('deadbeef...ef012345')).toBeInTheDocument();
  });

  it('should call verifyDocumentHash when Verify Hash button is clicked', async () => {
    const doc = makeDocument({ id: 42, fileHash: 'somehash1234567890' });

    render(<DocumentInventory documents={[doc]} />);

    const verifyButton = screen.getByRole('button', { name: /verify hash/i });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(mockVerifyDocumentHash).toHaveBeenCalledWith(
        BigInt(42),
        'somehash1234567890',
        'csrf-test-token'
      );
    });
  });

  it('should disable button while verification is in progress', async () => {
    // Make the mock hang so we can test the intermediate state
    let resolveVerify: (value: boolean) => void = () => {};
    mockVerifyDocumentHash.mockImplementation(
      () => new Promise<boolean>(resolve => { resolveVerify = resolve; })
    );

    const doc = makeDocument({ id: 1 });

    render(<DocumentInventory documents={[doc]} />);

    const verifyButton = screen.getByRole('button', { name: /verify hash/i });
    fireEvent.click(verifyButton);

    // Button should be disabled while verifying
    await waitFor(() => {
      expect(verifyButton).toBeDisabled();
    });

    // Resolve the promise
    resolveVerify(true);

    // Button should re-enable after verification completes
    await waitFor(() => {
      expect(verifyButton).not.toBeDisabled();
    });
  });

  it('should show check icon on successful verification', async () => {
    mockVerifyDocumentHash.mockResolvedValue(true);
    const doc = makeDocument({ id: 1 });

    const { container } = render(<DocumentInventory documents={[doc]} />);

    const verifyButton = screen.getByRole('button', { name: /verify hash/i });
    fireEvent.click(verifyButton);

    // After successful verification, a CheckCircle icon should appear
    // The lucide CheckCircle renders as an svg with class containing emerald
    await waitFor(() => {
      const svg = container.querySelector('.text-green-600');
      expect(svg).toBeTruthy();
    });
  });

  it('should show X icon on failed verification', async () => {
    mockVerifyDocumentHash.mockRejectedValue(new Error('Hash mismatch'));
    const doc = makeDocument({ id: 1 });

    const { container } = render(<DocumentInventory documents={[doc]} />);

    const verifyButton = screen.getByRole('button', { name: /verify hash/i });
    fireEvent.click(verifyButton);

    // After failed verification, an XCircle (red) should appear
    await waitFor(() => {
      const svg = container.querySelector('.text-red-500');
      expect(svg).toBeTruthy();
    });
  });

  it('should not fire another verification if already verifying', async () => {
    let resolveVerify: (value: boolean) => void = () => {};
    mockVerifyDocumentHash.mockImplementation(
      () => new Promise<boolean>(resolve => { resolveVerify = resolve; })
    );

    const doc = makeDocument({ id: 1 });

    render(<DocumentInventory documents={[doc]} />);

    const verifyButton = screen.getByRole('button', { name: /verify hash/i });

    // Click once
    fireEvent.click(verifyButton);

    // Try clicking again while still verifying (button is disabled)
    fireEvent.click(verifyButton);

    // Should only have been called once. Awaited because the handler now
    // fetches a CSRF token before calling — the 'verifying' state is still set
    // synchronously on the first click, so the second click is a no-op.
    await waitFor(() => expect(mockVerifyDocumentHash).toHaveBeenCalledTimes(1));

    // Cleanup
    resolveVerify(true);
  });
});
