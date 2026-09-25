// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AgentListingRow } from '@/types/estateAgentListing.types';
import type { DealStall } from '@/services/stall.service';

vi.mock('@/hooks/useEstateAgentOrg', () => ({ useEstateAgentOrg: vi.fn() }));
vi.mock('@/services/estateAgentListings.service', () => ({
  estateAgentListingsService: { listByOrganisation: vi.fn() },
}));
vi.mock('@/hooks/useDealStalls', () => ({ useDealStalls: vi.fn() }));
vi.mock('@/hooks/useDeskSignals', () => ({ useDeskSignals: () => ({ actingForByTx: { tx_1: ['seller'] }, nextDueByTx: {} }) }));

import { useEstateAgentOrg } from '@/hooks/useEstateAgentOrg';
import { useDealStalls } from '@/hooks/useDealStalls';
import { estateAgentListingsService } from '@/services/estateAgentListings.service';
import PipelinePage from '../PipelinePage';

const mockOrg = vi.mocked(useEstateAgentOrg);
const mockStalls = vi.mocked(useDealStalls);
const mockList = vi.mocked(estateAgentListingsService.listByOrganisation);

const row = (id: string, address: string, transactionId: string | null): AgentListingRow =>
  ({
    id, organisation_id: 'ag', slug: null, status: 'sold_stc', source: 'manual', source_url: null,
    listing: { address, postcode: 'SG19 1AA', price: 325000 }, provenance: {}, material_info: {},
    transaction_id: transactionId, published_at: null, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
  }) as unknown as AgentListingRow;

const stall = (days: number, owner: DealStall['owner'], label: string): DealStall =>
  ({ signal: 'x', owner, since: '', days, label, detail: {} });

function renderPage(): ReturnType<typeof render> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PipelinePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PipelinePage', () => {
  beforeEach(() => {
    mockOrg.mockReturnValue({ organisationId: 'ag', isLoading: false } as unknown as ReturnType<typeof useEstateAgentOrg>);
    mockStalls.mockReturnValue({});
    mockList.mockReset();
  });

  it('lists live sales longest wait first, by role, with a link to the listing', async () => {
    mockList.mockResolvedValue([row('l1', '14 Elm Road', 'tx_1'), row('l2', '7 Mill Lane', 'tx_2'), row('l3', '22 High St', 'tx_3'), row('l4', 'Draft only', null)]);
    mockStalls.mockReturnValue({
      tx_1: [stall(9, 'buyer', 'buyer pack not started')],
      tx_2: [stall(12, 'seller_conveyancer', 'enquiries waiting for an answer')],
      tx_3: [],
    });
    renderPage();
    const rows = await screen.findAllByTestId('chase-row');
    expect(rows.map((r) => r.getAttribute('data-days'))).toEqual(['12', '9', '']);
    expect(rows[0]).toHaveTextContent('7 Mill Lane');
    expect(rows[0]).toHaveTextContent("Waiting on the seller's conveyancer: enquiries waiting for an answer, 12 days");
    expect(rows[0]).toHaveAttribute('href', '/estate-agent/listings/l2');
    expect(rows[2]).toHaveTextContent('Nothing waiting');
    expect(rows[1]).toHaveTextContent('Acting for the seller');
    expect(screen.getByTestId('pipeline-summary')).toHaveTextContent('3 live sales · 2 waiting on someone');
    expect(screen.queryByText('Draft only')).toBeNull();
    expect(mockStalls).toHaveBeenLastCalledWith(['tx_1', 'tx_2', 'tx_3']);
  });

  it('says it is still checking until every live deal has answered, never "Nothing waiting"', async () => {
    mockList.mockResolvedValue([row('l1', '14 Elm Road', 'tx_1'), row('l2', '7 Mill Lane', 'tx_2')]);
    mockStalls.mockReturnValue({ tx_1: [] });
    renderPage();
    const rows = await screen.findAllByTestId('chase-row');
    expect(rows.map((r) => r.getAttribute('data-pending'))).toEqual(['true', 'true']);
    expect(rows[0]).toHaveTextContent('Checking who it is waiting on');
    expect(screen.queryByText('Nothing waiting')).toBeNull();
    expect(screen.getByTestId('pipeline-summary')).toHaveTextContent('2 live sales · checking who they are waiting on');
  });

  it('a failed listings read is an error with a retry, never an empty desk', async () => {
    mockList.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([row('l1', '14 Elm Road', 'tx_1')]);
    mockStalls.mockReturnValue({ tx_1: [] });
    renderPage();
    expect(await screen.findByTestId('pipeline-error')).toHaveTextContent("Couldn't load your listings");
    expect(screen.queryByTestId('pipeline-empty')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('chase-row')).toHaveTextContent('14 Elm Road');
  });

  it('shows the empty state when no listing has a sale behind it', async () => {
    mockList.mockResolvedValue([row('l1', 'Draft only', null)]);
    renderPage();
    expect(await screen.findByTestId('pipeline-empty')).toHaveTextContent('No live sales yet');
    expect(screen.getByRole('link', { name: 'Go to listings' })).toHaveAttribute('href', '/estate-agent/listings');
  });

  it('shows the unlinked state without an agency', () => {
    mockOrg.mockReturnValue({ organisationId: null, isLoading: false } as unknown as ReturnType<typeof useEstateAgentOrg>);
    renderPage();
    expect(screen.getByText("Your account isn't linked to an agency yet")).toBeInTheDocument();
    expect(mockList).not.toHaveBeenCalled();
  });
});
