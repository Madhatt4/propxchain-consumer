import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockWalletVcMode = vi.fn();
vi.mock('@/services/walletVc.service', () => ({
  walletVcMode: () => mockWalletVcMode(),
}));

// Isolate the wrapper from the two heavy sub-surfaces.
vi.mock('../TransactionDocumentsTab', () => ({
  TransactionDocumentsTab: () => <div>DOCS SURFACE</div>,
}));
vi.mock('../WalletVcTab', () => ({
  WalletVcTab: () => <div>CREDS SURFACE</div>,
}));

import { TransactionWalletTab } from '../TransactionWalletTab';

const props = { transactionId: 'TX-1', locked: false, requiredTier: 'starter' as const };

describe('TransactionWalletTab', () => {
  beforeEach(() => mockWalletVcMode.mockReturnValue('demo'));

  it('should hide the Credentials sub-tab entirely when no verifier is configured', () => {
    mockWalletVcMode.mockReturnValue('unavailable');
    render(<TransactionWalletTab {...props} />);
    expect(screen.getByText('DOCS SURFACE')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Credentials/i })).not.toBeInTheDocument();
  });

  it('should show the Documents sub-tab by default', () => {
    render(<TransactionWalletTab {...props} />);
    expect(screen.getByText('DOCS SURFACE')).toBeInTheDocument();
    expect(screen.queryByText('CREDS SURFACE')).not.toBeInTheDocument();
  });

  it('should switch to Credentials when its sub-tab is clicked', () => {
    render(<TransactionWalletTab {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Credentials/i }));
    expect(screen.getByText('CREDS SURFACE')).toBeInTheDocument();
    expect(screen.queryByText('DOCS SURFACE')).not.toBeInTheDocument();
  });
});
