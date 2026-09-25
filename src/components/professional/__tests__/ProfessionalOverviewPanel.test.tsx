import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { ProfessionalOverviewPanel } from '../ProfessionalOverviewPanel';
import type { ProfessionalOverview } from '../../../services/professionalOverview';

vi.mock('../../../services/icp.service', () => ({
  icpService: {
    get ledgerManager() {
      return { getEventsByTransaction: vi.fn() };
    },
  },
}));

function makeOverview(overrides: Partial<ProfessionalOverview> = {}): ProfessionalOverview {
  return {
    stats: { total: 10, active: 6, exchanging: 2, completing: 1, completed: 1 },
    attention: [],
    transactions: [],
    formsTotals: {
      sellerFormsComplete: 8,
      searchesOrdered: 5,
      contractExchanged: 3,
      completed: 1,
    },
    ...overrides,
  };
}

describe('ProfessionalOverviewPanel', () => {
  it('renders empty state when no transactions are passed', () => {
    render(
      <ProfessionalOverviewPanel
        transactions={[]}
        overviewOverride={makeOverview({
          stats: { total: 0, active: 0, exchanging: 0, completing: 0, completed: 0 },
        })}
      />,
    );
    expect(screen.getByText(/No transactions to report on yet/)).toBeInTheDocument();
  });

  it('renders stat tiles with their values', () => {
    render(
      <ProfessionalOverviewPanel transactions={[]} overviewOverride={makeOverview()} />,
    );
    expect(screen.getByText('10 transactions')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Exchanging')).toBeInTheDocument();
    expect(screen.getByText('Completing')).toBeInTheDocument();
    // "Completed" appears in both the stat tile and the progress row — at
    // least one must be present.
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
  });

  it('renders progress rows as N / M · P%', () => {
    render(
      <ProfessionalOverviewPanel transactions={[]} overviewOverride={makeOverview()} />,
    );
    expect(screen.getByText(/8 \/ 10 · 80%/)).toBeInTheDocument();
    expect(screen.getByText(/5 \/ 10 · 50%/)).toBeInTheDocument();
  });

  it('renders attention items with urgency chips and the property address', () => {
    const overview = makeOverview({
      attention: [
        {
          transactionId: 'tx-a',
          propertyAddress: '10 Main Street',
          reminder: {
            id: 'sdlt-deadline',
            urgency: 'critical',
            message: 'SDLT return due',
            suggestedAction: 'File it now.',
            triggeredAt: 0,
            source: 'blockchain_completed',
          },
        },
      ],
    });
    render(
      <ProfessionalOverviewPanel transactions={[]} overviewOverride={overview} />,
    );
    expect(screen.getByText('10 Main Street')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('SDLT return due')).toBeInTheDocument();
  });

  it('calls onTransactionClick when the address button is clicked', () => {
    const onClick = vi.fn();
    const overview = makeOverview({
      attention: [
        {
          transactionId: 'tx-a',
          propertyAddress: '10 Main Street',
          reminder: {
            id: 'sdlt-deadline',
            urgency: 'critical',
            message: 'SDLT return due',
            suggestedAction: 'File it now.',
            triggeredAt: 0,
            source: 'blockchain_completed',
          },
        },
      ],
    });
    render(
      <ProfessionalOverviewPanel
        transactions={[]}
        overviewOverride={overview}
        onTransactionClick={onClick}
      />,
    );
    fireEvent.click(screen.getByText('10 Main Street'));
    expect(onClick).toHaveBeenCalledWith('tx-a');
  });

  it('renders nothing when overviewOverride is null', () => {
    const { container } = render(
      <ProfessionalOverviewPanel transactions={[]} overviewOverride={null} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
