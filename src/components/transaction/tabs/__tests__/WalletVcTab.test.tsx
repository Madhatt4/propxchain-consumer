// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2025 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WalletVcTab } from '../WalletVcTab';
import * as svc from '@/services/walletVc.service';

vi.mock('@/services/walletVc.service', () => ({
  walletVcMode: vi.fn(),
  getPresentationRequest: vi.fn(),
  verifyPresented: vi.fn(),
}));

const sampleRequest = {
  request: 'openid4vp://?txId=sample&type=MortgageOfferCredential',
  requestedClaims: ['lender', 'offerReference', 'propertyAddress', 'offerAmountPence'],
};
const sampleVerified = {
  verified: true,
  claims: { lender: 'Halifax', offerReference: 'HX-2026-884213', propertyAddress: '78 Durley Avenue, Pinner HA5 1JH', offerAmountPence: 41200000 },
  credentialType: 'MortgageOfferCredential',
  issuer: 'did:web:test-bank.example',
  provenance: { alg: 'ES256', kid: 'test-issuer-key-1', verifiedAt: '2026-06-17T00:00:00Z' },
};

describe('WalletVcTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(svc.walletVcMode).mockReturnValue('demo');
    vi.mocked(svc.getPresentationRequest).mockResolvedValue(sampleRequest);
    vi.mocked(svc.verifyPresented).mockResolvedValue(sampleVerified);
  });

  it('renders the credentials list, request panel and verified result', async () => {
    render(<WalletVcTab transactionId="tx-1" locked={false} requiredTier="starter" />);
    expect(await screen.findByText(/Credentials for this transaction/i)).toBeInTheDocument();
    expect(await screen.findByText(/Scan to share your mortgage offer/i)).toBeInTheDocument();
    // Unique to the verified panel (avoids the duplicate "Verified" chip in the list).
    expect(await screen.findByText(/Signature & claims valid/i)).toBeInTheDocument();
    expect(await screen.findByText(/HX-2026-884213/)).toBeInTheDocument();
    expect(await screen.findByText(/On-chain proof-of-use/i)).toBeInTheDocument();
  });

  it('renders an error state when the presentation request fails', async () => {
    vi.mocked(svc.getPresentationRequest).mockRejectedValueOnce(new Error('boom'));
    render(<WalletVcTab transactionId="tx-1" locked={false} requiredTier="starter" />);
    expect(await screen.findByText(/Couldn[’']t load/i)).toBeInTheDocument();
  });

  it('shows the unavailable gate (no sample data) when no verifier is configured', () => {
    vi.mocked(svc.walletVcMode).mockReturnValue('unavailable');
    render(<WalletVcTab transactionId="tx-1" locked={false} requiredTier="starter" />);
    expect(screen.getByText(/isn[’']t available yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/Halifax/)).not.toBeInTheDocument();
    expect(svc.getPresentationRequest).not.toHaveBeenCalled();
  });
});
