import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockFetchPublic = vi.fn();
vi.mock('@/services/walletProof.service', () => ({
  walletProofService: { fetchPublic: (...a: unknown[]) => mockFetchPublic(...a) },
}));

import WalletProofPage from '../WalletProofPage';

function renderAt(token: string): void {
  render(
    <MemoryRouter initialEntries={[`/proof/${token}`]}>
      <Routes>
        <Route path="/proof/:token" element={<WalletProofPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('WalletProofPage', () => {
  it('should render each anchored item without any file, name or address', async () => {
    mockFetchPublic.mockResolvedValue({
      items: [
        { slotLabel: 'Proof of Identity', hashPrefix: 'abcdef123456', blockchainId: 7, anchoredAt: '2026-08-01T10:00:00Z', verifiedAt: '2026-08-18T10:00:00Z' },
        { slotLabel: 'Custom document', hashPrefix: '0123456789ab', blockchainId: 9, anchoredAt: null, verifiedAt: null },
      ],
      expiresAt: '2026-08-19T10:00:00Z',
      generatedAt: '2026-08-18T10:00:00Z',
    });
    renderAt('f'.repeat(64));
    expect(await screen.findByText('Proof of Identity')).toBeInTheDocument();
    expect(screen.getAllByText('Anchored').length).toBeGreaterThan(0);
    expect(screen.getByText('Unverified')).toBeInTheDocument();
    expect(screen.getByText(/abcdef123456…/)).toBeInTheDocument();
    expect(screen.getByText('#7')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /download/i })).not.toBeInTheDocument();
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
  });

  it('should show the same not-available state for unknown / expired / revoked', async () => {
    mockFetchPublic.mockResolvedValue(null);
    renderAt('a'.repeat(64));
    expect(await screen.findByText(/isn’t available/)).toBeInTheDocument();
  });
});
