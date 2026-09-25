import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { SearchesTrackingPanel } from '../SearchesTrackingPanel';
import { SEARCH_DEFINITIONS } from '../../../services/searchesService';
import type { SearchState } from '../../../services/searchesService';

vi.mock('../../../services/icp.service', () => ({
  icpService: {
    get ledgerManager() {
      return { getEventsByTransaction: vi.fn() };
    },
  },
}));

function makeState(def: typeof SEARCH_DEFINITIONS[number], status: SearchState['status']): SearchState {
  return {
    ...def,
    status,
    orderedAt: status === 'notOrdered' ? null : 0,
    expectedBy: status === 'notOrdered' ? null : def.typicalReturnDays * 86_400_000,
    expiresAt: status === 'notOrdered' ? null : (def.typicalReturnDays + def.validityDays) * 86_400_000,
    daysUntilExpiry: status === 'notOrdered' || status === 'expired' ? null : 100,
  };
}

describe('SearchesTrackingPanel', () => {
  it('renders nothing when states override is null (error path)', () => {
    const { container } = render(
      <SearchesTrackingPanel transactionId="tx-1" statesOverride={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders all 7 search labels when given a full state list', () => {
    const states = SEARCH_DEFINITIONS.map((d) => makeState(d, 'notOrdered'));
    render(<SearchesTrackingPanel transactionId="tx-1" statesOverride={states} />);
    for (const def of SEARCH_DEFINITIONS) {
      expect(screen.getByText(def.label)).toBeInTheDocument();
    }
  });

  it('shows "0 of 7 ordered" when nothing is ordered', () => {
    const states = SEARCH_DEFINITIONS.map((d) => makeState(d, 'notOrdered'));
    render(<SearchesTrackingPanel transactionId="tx-1" statesOverride={states} />);
    expect(screen.getByText(/0 of 7 ordered/)).toBeInTheDocument();
  });

  it('renders "Ordered" badge for each ordered search', () => {
    const states = SEARCH_DEFINITIONS.map((d) => makeState(d, 'ordered'));
    render(<SearchesTrackingPanel transactionId="tx-1" statesOverride={states} />);
    const ordered = screen.getAllByText('Ordered');
    expect(ordered.length).toBe(7);
  });

  it('renders the "Expiring soon" badge when status is expiringSoon', () => {
    const states = [makeState(SEARCH_DEFINITIONS[0], 'expiringSoon')];
    render(<SearchesTrackingPanel transactionId="tx-1" statesOverride={states} />);
    expect(screen.getByText('Expiring soon')).toBeInTheDocument();
  });

  it('renders the "Expired" badge when status is expired', () => {
    const states = [makeState(SEARCH_DEFINITIONS[0], 'expired')];
    render(<SearchesTrackingPanel transactionId="tx-1" statesOverride={states} />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('shows conditional text for situational searches like OS1 and Coal Mining', () => {
    const coal = SEARCH_DEFINITIONS.find((s) => s.id === 'coal-mining')!;
    const os1 = SEARCH_DEFINITIONS.find((s) => s.id === 'os1-priority')!;
    render(
      <SearchesTrackingPanel
        transactionId="tx-1"
        statesOverride={[makeState(coal, 'notOrdered'), makeState(os1, 'notOrdered')]}
      />,
    );
    expect(screen.getByText(/CA1 authority regions/)).toBeInTheDocument();
    expect(screen.getByText(/pre-completion/)).toBeInTheDocument();
  });
});
