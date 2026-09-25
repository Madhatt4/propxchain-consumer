import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { PhaseChecklist } from '../PhaseChecklist';
import type { PhaseChecklistState } from '../../../services/phaseChecklist';

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

function makeState(overrides: Partial<PhaseChecklistState> = {}): PhaseChecklistState {
  return {
    phase: 'sellerPrep',
    items: [
      { id: 'a', label: 'Do thing A', completedByEvents: ['a'], completed: true, completedAt: 1000 },
      { id: 'b', label: 'Do thing B', completedByEvents: ['b'], completed: false, completedAt: null },
      { id: 'c', label: 'Do thing C', completedByEvents: ['c'], completed: false, completedAt: null },
    ],
    progress: 1 / 3,
    ...overrides,
  };
}

describe('PhaseChecklist — override path', () => {
  it('renders each item with correct completion state', () => {
    render(<PhaseChecklist transactionId="tx-1" stateOverride={makeState()} />);
    expect(screen.getByText('Do thing A')).toBeInTheDocument();
    expect(screen.getByText('Do thing B')).toBeInTheDocument();
    expect(screen.getByLabelText('done')).toBeInTheDocument();
    expect(screen.getAllByLabelText('pending')).toHaveLength(2);
  });

  it('shows the completed ratio and percent', () => {
    render(<PhaseChecklist transactionId="tx-1" stateOverride={makeState()} />);
    expect(screen.getByText(/1 of 3 done · 33%/)).toBeInTheDocument();
  });

  it('renders nothing when stateOverride is null', () => {
    const { container } = render(<PhaseChecklist transactionId="tx-1" stateOverride={null} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('PhaseChecklist — live fetch path', () => {
  beforeEach(() => {
    mockGetTransaction.mockReset();
    mockGetEventsByTransaction.mockReset();
  });

  it('derives phase + checklist from transaction + events', async () => {
    mockGetTransaction.mockResolvedValueOnce([
      { id: 'tx-1', buyer: 'buyer-p', seller: 'seller-p', status: { active: null } },
    ]);
    mockGetEventsByTransaction.mockResolvedValueOnce([
      { eventType: 'buyer_joined', timestamp: 1 },
    ]);

    render(<PhaseChecklist transactionId="tx-1" />);
    await waitFor(() =>
      expect(screen.getByText('Buyer joined the transaction')).toBeInTheDocument(),
    );
  });

  it('renders nothing when transaction fetch returns empty', async () => {
    mockGetTransaction.mockResolvedValueOnce([]);
    mockGetEventsByTransaction.mockResolvedValueOnce([]);

    const { container } = render(<PhaseChecklist transactionId="tx-missing" />);
    await waitFor(() => expect(container.firstChild).toBeNull());
  });
});
