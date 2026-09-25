// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AgentListingRow } from '@/types/estateAgentListing.types';
import type { PropertyListing, ProvenanceMap } from '@/types/listing.types';

vi.mock('@/hooks/useEstateAgentOrg', () => ({
  useEstateAgentOrg: vi.fn(),
}));

vi.mock('@/services/estateAgentListings.service', () => ({
  estateAgentListingsService: {
    getById: vi.fn(),
    update: vi.fn(),
    setStatus: vi.fn(),
    publish: vi.fn(),
  },
}));

vi.mock('@/services/epc.service', () => ({
  lookupEpc: vi.fn(),
}));

vi.mock('@/services/partyInvite.service', () => ({
  partyInviteService: { listForTransaction: vi.fn(() => Promise.resolve([])) },
}));

vi.mock('@/components/forms/ListingEditForm', () => ({
  default: ({
    listing,
    onSave,
  }: {
    listing: PropertyListing;
    onSave: (updated: PropertyListing, provenance: ProvenanceMap) => void;
  }) => (
    <button type="button" onClick={() => onSave({ ...listing, price: 999000 }, {})}>
      mock-save-details
    </button>
  ),
}));

vi.mock('@/stores/authStore', () => ({
  usePrincipalId: vi.fn(() => 'agent-principal-1'),
}));

vi.mock('@/components/estate-agent/StartSaleModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>mock-start-sale-modal</div> : null),
}));

vi.mock('@/components/estate-agent/ClientPanel', () => ({ default: () => <div data-testid="client-panel" /> }));
vi.mock('@/components/estate-agent/ChaseLogPanel', () => ({ default: () => <div data-testid="chase-log-panel" /> }));

vi.mock('@/components/transaction/flow/StallLine', () => ({
  StallLine: (props: { transactionId: string }) => <div data-testid="stall-line" data-tx={props.transactionId} />,
}));

vi.mock('@/components/estate-agent/ListingPartiesSection', () => ({
  default: ({ transactionId }: { transactionId: string }) => <div>mock-parties-section-{transactionId}</div>,
}));

import { useEstateAgentOrg } from '@/hooks/useEstateAgentOrg';
import { estateAgentListingsService } from '@/services/estateAgentListings.service';
import { lookupEpc } from '@/services/epc.service';
import { usePrincipalId } from '@/stores/authStore';
import ListingDetailPage from '../ListingDetailPage';

const mockUseEstateAgentOrg = vi.mocked(useEstateAgentOrg);
const mockGetById = vi.mocked(estateAgentListingsService.getById);
const mockUpdate = vi.mocked(estateAgentListingsService.update);
const mockSetStatus = vi.mocked(estateAgentListingsService.setStatus);
const mockPublish = vi.mocked(estateAgentListingsService.publish);
const mockLookupEpc = vi.mocked(lookupEpc);
const mockUsePrincipalId = vi.mocked(usePrincipalId);

function baseListing(overrides: Partial<PropertyListing>): PropertyListing {
  return {
    url: '',
    listingId: 'l1',
    source: 'manual',
    address: '1 High St, Sandy',
    postcode: 'SG19 1AA',
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
    slug: 'acme-homes-sg19-abc123',
    status: 'for_sale',
    source: 'manual',
    source_url: null,
    agent_url: null,
    listing: baseListing({}),
    provenance: {},
    material_info: {
      price: { value: 250000, source: 'listing' },
      tenure: { value: 'freehold', source: 'listing' },
      councilTaxBand: { value: null, source: 'missing' },
      epcRating: { value: null, source: 'missing' },
      epcFloorAreaSqm: { value: null, source: 'missing' },
      leaseYearsRemaining: { value: null, source: 'missing' },
      groundRentPerYear: { value: null, source: 'missing' },
      serviceChargePerYear: { value: null, source: 'missing' },
      floodRisk: { value: null, source: 'missing' },
      conservationArea: { value: null, source: 'missing' },
      listedBuilding: { value: null, source: 'missing' },
    },
    transaction_id: null,
    published_at: '2026-08-01T00:00:00.000Z',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderPage(id = 'row-1'): ReturnType<typeof render> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/estate-agent/listings/${id}`]}>
        <Routes>
          <Route path="/estate-agent/listings/:id" element={<ListingDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ListingDetailPage', () => {
  beforeEach(() => {
    mockUseEstateAgentOrg.mockReturnValue({
      organisationId: 'ag',
      organisationName: 'Acme Homes',
      isLoading: false,
      isError: false,
    });
    mockLookupEpc.mockResolvedValue(null);
    mockUpdate.mockResolvedValue(makeRow({}));
    mockSetStatus.mockResolvedValue(undefined);
    mockPublish.mockResolvedValue('acme-homes-sg19-abc123');
    mockUsePrincipalId.mockReturnValue('agent-principal-1');
  });

  it('renders the address and status badge', async () => {
    mockGetById.mockResolvedValue(makeRow({}));
    renderPage();
    expect(await screen.findByRole('heading', { name: '1 High St, Sandy' })).toBeInTheDocument();
    expect(screen.getAllByText('For sale').length).toBeGreaterThan(0);
  });

  it('links to the public page using the listing slug', async () => {
    mockGetById.mockResolvedValue(makeRow({ slug: 'acme-homes-sg19-abc123' }));
    renderPage();
    const link = await screen.findByRole('link', { name: /view public page/i });
    expect(link).toHaveAttribute('href', '/property/acme-homes-sg19-abc123');
  });

  it('changing the status select calls setStatus', async () => {
    mockGetById.mockResolvedValue(makeRow({}));
    renderPage();
    const select = await screen.findByLabelText(/status/i);
    fireEvent.change(select, { target: { value: 'sold_stc' } });
    await waitFor(() => expect(mockSetStatus).toHaveBeenCalledWith('row-1', 'sold_stc'));
  });

  it('saving material information sends the merged info with the agent override', async () => {
    mockGetById.mockResolvedValue(makeRow({}));
    renderPage();

    const councilTaxInput = await screen.findByLabelText(/council tax band/i);
    fireEvent.change(councilTaxInput, { target: { value: 'D' } });

    fireEvent.click(screen.getByRole('button', { name: /save material information/i }));

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        'row-1',
        expect.objectContaining({
          material_info: expect.objectContaining({
            councilTaxBand: { value: 'D', source: 'agent' },
          }),
        }),
      ),
    );
  });

  it('shows a Publish button for a draft with no slug and publishes with the agency name', async () => {
    mockGetById.mockResolvedValue(makeRow({ status: 'draft', slug: null, published_at: null }));
    renderPage();

    const publishButton = await screen.findByRole('button', { name: /^publish$/i });
    fireEvent.click(publishButton);

    await waitFor(() => expect(mockPublish).toHaveBeenCalledWith('row-1', 'Acme Homes'));
  });

  it('persists the current merged material_info before publishing', async () => {
    mockGetById.mockResolvedValue(makeRow({ status: 'draft', slug: null, published_at: null }));
    renderPage();

    const publishButton = await screen.findByRole('button', { name: /^publish$/i });
    fireEvent.click(publishButton);

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        'row-1',
        expect.objectContaining({
          material_info: expect.objectContaining({
            price: { value: 250000, source: 'listing' },
          }),
        }),
      ),
    );
    expect(mockPublish).toHaveBeenCalledWith('row-1', 'Acme Homes');
  });

  it('shows an error when publishing fails', async () => {
    mockGetById.mockResolvedValue(makeRow({ status: 'draft', slug: null, published_at: null }));
    mockPublish.mockRejectedValue(new Error('publish boom'));
    renderPage();

    const publishButton = await screen.findByRole('button', { name: /^publish$/i });
    fireEvent.click(publishButton);

    expect(await screen.findByText('publish boom')).toBeInTheDocument();
  });

  it('shows an error when the status change fails', async () => {
    mockGetById.mockResolvedValue(makeRow({}));
    mockSetStatus.mockRejectedValue(new Error('status boom'));
    renderPage();

    const select = await screen.findByLabelText(/status/i);
    fireEvent.change(select, { target: { value: 'sold_stc' } });

    expect(await screen.findByText('status boom')).toBeInTheDocument();
  });

  it('rebuilds material_info from the edited listing when saving details', async () => {
    mockGetById.mockResolvedValue(makeRow({}));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /edit details/i }));
    fireEvent.click(screen.getByRole('button', { name: /mock-save-details/i }));

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        'row-1',
        expect.objectContaining({
          listing: expect.objectContaining({ price: 999000 }),
          material_info: expect.objectContaining({
            price: { value: 999000, source: 'listing' },
          }),
        }),
      ),
    );
  });

  it('disables Publish and never calls publish while the agency name has not resolved', async () => {
    mockPublish.mockClear();
    mockUseEstateAgentOrg.mockReturnValue({
      organisationId: 'ag',
      organisationName: null,
      isLoading: false,
      isError: false,
    });
    mockGetById.mockResolvedValue(makeRow({ status: 'draft', slug: null, published_at: null }));
    renderPage();

    const publishButton = await screen.findByRole('button', { name: /^publish$/i });
    expect(publishButton).toBeDisabled();

    fireEvent.click(publishButton);
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('enables Start sale and opens the modal for an unlinked listing', async () => {
    mockGetById.mockResolvedValue(makeRow({ transaction_id: null }));
    renderPage();

    const startSaleButton = await screen.findByRole('button', { name: /start sale/i });
    expect(startSaleButton).not.toBeDisabled();

    fireEvent.click(startSaleButton);
    expect(await screen.findByText('mock-start-sale-modal')).toBeInTheDocument();
  });

  it('shows the parties section and no Start sale button once linked to a transaction', async () => {
    mockGetById.mockResolvedValue(makeRow({ transaction_id: 'tx-1' }));
    renderPage();

    expect(await screen.findByText('mock-parties-section-tx-1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start sale/i })).not.toBeInTheDocument();
  });

  it('disables Start sale and never opens the modal while agentPrincipal has not resolved', async () => {
    mockUsePrincipalId.mockReturnValue(null);
    mockGetById.mockResolvedValue(makeRow({ transaction_id: null }));
    renderPage();

    const startSaleButton = await screen.findByRole('button', { name: /start sale/i });
    expect(startSaleButton).toBeDisabled();
    expect(startSaleButton).toHaveAttribute('title', 'Restoring your identity…');

    fireEvent.click(startSaleButton);
    expect(screen.queryByText('mock-start-sale-modal')).not.toBeInTheDocument();
  });
});
