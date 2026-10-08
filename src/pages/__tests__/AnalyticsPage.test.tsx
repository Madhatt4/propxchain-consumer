import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import AnalyticsPage from '../AnalyticsPage';
import type { DealAnalytics } from '../../services/dealAnalytics';

const mockGetMyTransactions = vi.fn();
const mockLoadDealAnalytics = vi.fn();

vi.mock('../../services/icp.service', () => ({
  icpService: { getMyTransactions: () => mockGetMyTransactions() },
}));

vi.mock('../../services/dealAnalytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/dealAnalytics')>();
  return { ...actual, loadDealAnalytics: (id: string) => mockLoadDealAnalytics(id) };
});

vi.mock('../../stores/authStore', () => ({
  useAuthStore: { getState: () => ({ principalId: 'seller-principal', isAuthenticated: true }) },
}));

vi.mock('../../hooks/useSubscription', () => ({ useCanAccessFeature: () => true }));

vi.mock('@/components/navigation/AppTopBar', () => ({ default: () => null }));

vi.mock('@/components/common/NextStepCard', () => ({
  default: ({ txId }: { txId: string }) => <div data-testid="next-step">next step for {txId}</div>,
}));

vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const sale = {
  id: 'tx-1',
  propertyAddress: 'Headmaster Way, Macclesfield',
  transactionType: 'sale',
  seller: 'seller-principal',
  buyer: 'buyer-principal',
  completionDate: '',
};

const analytics: DealAnalytics = {
  checklist: {
    phase: 'searches',
    items: [
      { id: 'searches-ordered', label: 'Searches ordered', completedByEvents: [], completed: true, completedAt: 1 },
      { id: 'enquiries-raised', label: 'Enquiries raised', completedByEvents: [], completed: false, completedAt: null },
    ],
    progress: 0.5,
  },
  stage: { stage: 'enquiries', enteredAt: '2026-10-01', days: 12, benchmarkDays: 14, sampleN: 40 },
  stalls: [
    { signal: 'enquiries_open', owner: 'seller_conveyancer', since: '2026-09-29', days: 9, label: 'enquiries waiting for an answer', detail: {} },
  ],
};

function renderPage() {
  return render(<MemoryRouter><AnalyticsPage /></MemoryRouter>);
}

describe('AnalyticsPage', () => {
  beforeEach(() => {
    mockGetMyTransactions.mockResolvedValue([sale]);
    mockLoadDealAnalytics.mockResolvedValue(analytics);
  });

  it('shows the deal read from the audit trail and stall service, not a fixed task list', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByTestId('analytics-progress')).toHaveTextContent('50%'));
    expect(mockLoadDealAnalytics).toHaveBeenCalledWith('tx-1');
    expect(screen.getByTestId('analytics-stage')).toHaveTextContent('Enquiries: day 12 of a usual 14');
    expect(screen.getByText("Waiting on the seller's conveyancer: enquiries waiting for an answer, 9 days")).toBeInTheDocument();
    expect(screen.getByText('Enquiries raised')).toBeInTheDocument();
    expect(screen.getByTestId('next-step')).toHaveTextContent('next step for tx-1');

    // The old hardcoded buyer tasks are gone.
    expect(screen.queryByText('Upload Proof of Funds')).not.toBeInTheDocument();
    expect(screen.queryByText('Mortgage approval confirmation')).not.toBeInTheDocument();
  });

  it('says the target date is set at exchange instead of "Invalid Date"', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByTestId('analytics-target-date')).toHaveTextContent('Set at exchange'));
    expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument();
  });

  it('shows the agreed completion date once one is set', async () => {
    mockGetMyTransactions.mockResolvedValue([{ ...sale, completionDate: '2026-11-20' }]);
    renderPage();

    await waitFor(() => expect(screen.getByTestId('analytics-target-date')).toHaveTextContent('20/11/2026'));
  });
});
