import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { PhaseIndicator } from '../PhaseIndicator';

const mockGetTransaction = vi.fn();
const mockGetEventsByTransaction = vi.fn();

vi.mock('../../../services/icp.service', () => ({
  icpService: {
    get transactionManager() {
      return { getTransaction: (...args: unknown[]) => mockGetTransaction(...args) };
    },
    get ledgerManager() {
      return { getEventsByTransaction: (...args: unknown[]) => mockGetEventsByTransaction(...args) };
    },
  },
}));

function makeTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx-1',
    buyer: 'buyer-principal',
    seller: 'seller-principal',
    status: { active: null },
    ...overrides,
  };
}

function makeEvent(eventType: string, timestamp: number = 1_700_000_000) {
  return {
    eventId: 1,
    transactionId: 'tx-1',
    eventType,
    timestamp,
    caller: 'xyz',
    details: '',
    metadata: null,
  };
}

describe('PhaseIndicator — phaseOverride path (synchronous)', () => {
  it('renders the correct phase label when phaseOverride is set', () => {
    render(<PhaseIndicator transactionId="tx-1" phaseOverride="searches" />);
    expect(screen.getByText('Enquiries')).toBeInTheDocument();
    expect(screen.getByText('Phase 3 of 6')).toBeInTheDocument();
  });

  it('sets aria-valuenow to the current phase position', () => {
    render(<PhaseIndicator transactionId="tx-1" phaseOverride="preCompletion" />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '5');
    expect(progressbar).toHaveAttribute('aria-valuemax', '6');
    expect(progressbar).toHaveAttribute('aria-valuemin', '1');
  });

  it('renders #sellerPrep at position 1', () => {
    render(<PhaseIndicator transactionId="tx-1" phaseOverride="sellerPrep" />);
    expect(screen.getByText('Listing')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  });

  it('renders #completed at position 6', () => {
    render(<PhaseIndicator transactionId="tx-1" phaseOverride="completed" />);
    expect(screen.getByText('Post-completion')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '6');
  });

  it('renders nothing when phaseOverride is null', () => {
    const { container } = render(<PhaseIndicator transactionId="tx-1" phaseOverride={null} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('PhaseIndicator — live derivation path', () => {
  beforeEach(() => {
    mockGetTransaction.mockReset();
    mockGetEventsByTransaction.mockReset();
  });

  it('derives #sellerPrep when buyer equals seller', async () => {
    mockGetTransaction.mockResolvedValueOnce([
      makeTransaction({ buyer: 'same-principal', seller: 'same-principal' }),
    ]);
    mockGetEventsByTransaction.mockResolvedValueOnce([]);

    render(<PhaseIndicator transactionId="tx-1" />);
    await waitFor(() => expect(screen.getByText('Listing')).toBeInTheDocument());
  });

  it('derives #buyerSetup when buyer differs from seller but no milestone events', async () => {
    mockGetTransaction.mockResolvedValueOnce([makeTransaction()]);
    mockGetEventsByTransaction.mockResolvedValueOnce([]);

    render(<PhaseIndicator transactionId="tx-1" />);
    await waitFor(() => expect(screen.getByText('Offer accepted')).toBeInTheDocument());
  });

  it('derives #searches when a searches_ordered event is present', async () => {
    mockGetTransaction.mockResolvedValueOnce([makeTransaction()]);
    mockGetEventsByTransaction.mockResolvedValueOnce([makeEvent('searches_ordered')]);

    render(<PhaseIndicator transactionId="tx-1" />);
    await waitFor(() => expect(screen.getByText('Enquiries')).toBeInTheDocument());
  });

  it('derives #preContract when a party_signature event is present (contract drafted proxy)', async () => {
    mockGetTransaction.mockResolvedValueOnce([makeTransaction()]);
    mockGetEventsByTransaction.mockResolvedValueOnce([
      makeEvent('searches_ordered', 1_700_000_000),
      makeEvent('party_signature', 1_800_000_000),
    ]);

    render(<PhaseIndicator transactionId="tx-1" />);
    await waitFor(() => expect(screen.getByText('Exchange')).toBeInTheDocument());
  });

  it('derives #preCompletion from an exchanged transaction status, ignoring milestone events', async () => {
    mockGetTransaction.mockResolvedValueOnce([
      makeTransaction({ status: { exchanged: null } }),
    ]);
    mockGetEventsByTransaction.mockResolvedValueOnce([]);

    render(<PhaseIndicator transactionId="tx-1" />);
    await waitFor(() => expect(screen.getByText('Completion')).toBeInTheDocument());
  });

  it('derives #completed from a blockchain_completed status', async () => {
    mockGetTransaction.mockResolvedValueOnce([
      makeTransaction({ status: { blockchain_completed: null } }),
    ]);
    mockGetEventsByTransaction.mockResolvedValueOnce([]);

    render(<PhaseIndicator transactionId="tx-1" />);
    await waitFor(() => expect(screen.getByText('Post-completion')).toBeInTheDocument());
  });

  it('renders nothing when the transaction fetch returns an empty opt', async () => {
    mockGetTransaction.mockResolvedValueOnce([]);
    mockGetEventsByTransaction.mockResolvedValueOnce([]);

    const { container } = render(<PhaseIndicator transactionId="tx-missing" />);
    await waitFor(() => expect(container.firstChild).toBeNull());
  });

  it('tolerates a failed audit events fetch and still derives from the transaction record', async () => {
    mockGetTransaction.mockResolvedValueOnce([makeTransaction()]);
    mockGetEventsByTransaction.mockRejectedValueOnce(new Error('network'));

    render(<PhaseIndicator transactionId="tx-1" />);
    await waitFor(() => expect(screen.getByText('Offer accepted')).toBeInTheDocument());
  });
});
