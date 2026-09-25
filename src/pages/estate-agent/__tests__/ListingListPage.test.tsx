// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AgentListingRow } from '@/types/estateAgentListing.types';
import type { PropertyListing } from '@/types/listing.types';

vi.mock('@/hooks/useEstateAgentOrg', () => ({
  useEstateAgentOrg: vi.fn(),
}));

vi.mock('@/services/estateAgentListings.service', () => ({
  estateAgentListingsService: {
    listByOrganisation: vi.fn(),
  },
}));

import { useEstateAgentOrg } from '@/hooks/useEstateAgentOrg';
import { estateAgentListingsService } from '@/services/estateAgentListings.service';
import ListingListPage from '../ListingListPage';

const mockUseEstateAgentOrg = vi.mocked(useEstateAgentOrg);
const mockListByOrganisation = vi.mocked(estateAgentListingsService.listByOrganisation);

function baseListing(overrides: Partial<PropertyListing>): PropertyListing {
  return {
    url: '',
    listingId: 'l1',
    source: 'manual',
    address: '1 High St',
    postcode: 'AB1 2CD',
    price: 250000,
    propertyType: 'Terraced',
    bedrooms: 3,
    tenure: 'freehold',
    priceQualifier: '',
    bathrooms: 1,
    description: '',
    keyFeatures: [],
    images: [],
    floorplanUrl: null,
    epcRating: null,
    agentName: '',
    agentBranch: '',
    agentLogoUrl: null,
    councilTaxBand: null,
    propertyPhrase: '',
    provenance: {},
    ...overrides,
  };
}

function makeRow(overrides: Partial<AgentListingRow>): AgentListingRow {
  return {
    id: 'row-1',
    organisation_id: 'ag',
    slug: null,
    status: 'draft',
    source: 'manual',
    source_url: null,
    agent_url: null,
    listing: baseListing({}),
    provenance: {},
    material_info: {} as AgentListingRow['material_info'],
    transaction_id: null,
    published_at: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderPage(): ReturnType<typeof render> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ListingListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ListingListPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  /**
   * The overview panel summarises transactions, not listings. A listing only
   * has a transaction once a sale has been started from it, and most never
   * do — so the panel must stay out of the way until there is something
   * on-chain to report, rather than rendering an empty shell above the stock.
   */
  it('should not show the overview panel when no listing has a sale behind it', async () => {
    mockUseEstateAgentOrg.mockReturnValue({ organisationId: 'ag', organisationName: null, isLoading: false, isError: false });
    mockListByOrganisation.mockResolvedValue([
      makeRow({ id: 'row-1', transaction_id: null, listing: baseListing({ address: '1 High St' }) }),
    ]);

    renderPage();

    expect(await screen.findByText('1 High St')).toBeInTheDocument();
    expect(screen.queryByLabelText('Professional overview')).toBeNull();
  });

  it('should show the overview panel once a listing has a sale behind it', async () => {
    mockUseEstateAgentOrg.mockReturnValue({ organisationId: 'ag', organisationName: null, isLoading: false, isError: false });
    mockListByOrganisation.mockResolvedValue([
      makeRow({ id: 'row-1', transaction_id: 'tx-1', listing: baseListing({ address: '1 High St' }) }),
      makeRow({ id: 'row-2', transaction_id: null, listing: baseListing({ address: '2 Low Rd' }) }),
    ]);

    renderPage();

    // Only the linked listing is summarised — the unlinked one is dropped
    // rather than passed through as a transaction id that does not exist.
    expect(await screen.findByLabelText('Professional overview')).toBeInTheDocument();
    expect(screen.getByText('1 transaction')).toBeInTheDocument();
  });

  it('renders listings with addresses, status badges, and row links', async () => {
    mockUseEstateAgentOrg.mockReturnValue({ organisationId: 'ag', organisationName: null, isLoading: false, isError: false });
    mockListByOrganisation.mockResolvedValue([
      makeRow({ id: 'row-1', status: 'draft', listing: baseListing({ address: '1 High St' }) }),
      makeRow({ id: 'row-2', status: 'for_sale', listing: baseListing({ address: '2 Low Rd' }) }),
    ]);

    renderPage();

    expect(await screen.findByText('1 High St')).toBeInTheDocument();
    expect(screen.getByText('2 Low Rd')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('For sale')).toBeInTheDocument();

    expect(screen.getByText('1 High St').closest('a')).toHaveAttribute(
      'href',
      '/estate-agent/listings/row-1',
    );
    expect(screen.getByText('2 Low Rd').closest('a')).toHaveAttribute(
      'href',
      '/estate-agent/listings/row-2',
    );

    const addLink = screen.getByRole('link', { name: /add a listing/i });
    expect(addLink).toHaveAttribute('href', '/estate-agent/listings/new');
  });

  it('renders a loading state while the listings query is in flight', async () => {
    mockUseEstateAgentOrg.mockReturnValue({ organisationId: 'ag', organisationName: null, isLoading: false, isError: false });
    mockListByOrganisation.mockReturnValue(new Promise(() => {})); // never resolves

    renderPage();

    expect(await screen.findByText('Loading your listings…')).toBeInTheDocument();
    expect(
      screen.queryByText('No listings yet — paste a Rightmove link to add your first'),
    ).not.toBeInTheDocument();
  });

  it('renders the empty state when there are no listings', async () => {
    mockUseEstateAgentOrg.mockReturnValue({ organisationId: 'ag', organisationName: null, isLoading: false, isError: false });
    mockListByOrganisation.mockResolvedValue([]);

    renderPage();

    expect(
      await screen.findByText('No listings yet — paste a Rightmove link to add your first'),
    ).toBeInTheDocument();
  });

  it('renders the unlinked-account state when there is no organisation', () => {
    mockUseEstateAgentOrg.mockReturnValue({ organisationId: null, organisationName: null, isLoading: false, isError: false });

    renderPage();

    expect(screen.getByText("Your account isn't linked to an agency yet")).toBeInTheDocument();
    const registerLink = screen.getByRole('link', { name: /register/i });
    expect(registerLink).toHaveAttribute('href', '/register/estate-agent');
  });

  it('prefers the loading state over the unlinked-account state while the org is still resolving', () => {
    mockUseEstateAgentOrg.mockReturnValue({ organisationId: null, organisationName: null, isLoading: true, isError: false });

    renderPage();

    expect(screen.getByText('Loading your listings…')).toBeInTheDocument();
    expect(screen.queryByText("Your account isn't linked to an agency yet")).not.toBeInTheDocument();
  });

  describe('view toggle', () => {
    function arrangeTwoListings(): void {
      mockUseEstateAgentOrg.mockReturnValue({ organisationId: 'ag', organisationName: null, isLoading: false, isError: false });
      mockListByOrganisation.mockResolvedValue([
        makeRow({ id: 'row-1', listing: baseListing({ address: '1 High St', images: [{ url: 'https://img/1.jpg', caption: '' }] }) }),
        makeRow({ id: 'row-2', listing: baseListing({ address: '2 Low Rd' }) }),
      ]);
    }

    it('should default to the tile view with hero photos', async () => {
      arrangeTwoListings();

      renderPage();

      expect(await screen.findByText('1 High St')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /tile view/i })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: /list view/i })).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByTestId('listing-tile-grid')).toBeInTheDocument();
      expect(screen.getByRole('img', { name: /1 high st/i })).toHaveAttribute('src', 'https://img/1.jpg');
    });

    it('should switch to the list view when the list button is pressed', async () => {
      arrangeTwoListings();

      renderPage();
      await screen.findByText('1 High St');
      fireEvent.click(screen.getByRole('button', { name: /list view/i }));

      expect(screen.getByRole('button', { name: /list view/i })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('listing-row-list')).toBeInTheDocument();
      expect(screen.queryByTestId('listing-tile-grid')).not.toBeInTheDocument();
    });

    it('should remember the chosen view across remounts', async () => {
      arrangeTwoListings();

      const first = renderPage();
      await screen.findByText('1 High St');
      fireEvent.click(screen.getByRole('button', { name: /list view/i }));
      first.unmount();
      renderPage();

      expect(await screen.findByText('1 High St')).toBeInTheDocument();
      expect(screen.getByTestId('listing-row-list')).toBeInTheDocument();
    });

    it('should show a placeholder tile when the listing has no photo', async () => {
      arrangeTwoListings();

      renderPage();

      await screen.findByText('2 Low Rd');
      expect(screen.getByTestId('listing-tile-placeholder-row-2')).toBeInTheDocument();
      expect(screen.queryByRole('img', { name: /2 low rd/i })).not.toBeInTheDocument();
    });
  });
});
