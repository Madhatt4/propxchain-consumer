// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropertyListing } from '@/types/listing.types';
import type { AgentListingRow } from '@/types/estateAgentListing.types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/hooks/useEstateAgentOrg', () => ({
  useEstateAgentOrg: vi.fn(),
}));

vi.mock('@/services/estateAgentListings.service', () => ({
  estateAgentListingsService: {
    create: vi.fn(),
  },
}));

vi.mock('@/components/forms/ListingImport', () => ({
  default: ({ onImport }: { onImport: (l: PropertyListing) => void }) => (
    <button type="button" onClick={() => onImport(sampleListing)}>
      mock-import
    </button>
  ),
}));

vi.mock('@/components/forms/ListingEditForm', () => ({
  default: ({
    onSave,
  }: {
    onSave: (l: PropertyListing, p: Record<string, string>) => void;
  }) => (
    <button type="button" onClick={() => onSave(manualListing, {})}>
      mock-save
    </button>
  ),
}));

import { useEstateAgentOrg } from '@/hooks/useEstateAgentOrg';
import { estateAgentListingsService } from '@/services/estateAgentListings.service';
import ListingCreatePage from '../ListingCreatePage';

const mockUseEstateAgentOrg = vi.mocked(useEstateAgentOrg);
const mockCreate = vi.mocked(estateAgentListingsService.create);

const sampleListing: PropertyListing = {
  url: 'https://www.rightmove.co.uk/properties/123',
  listingId: '123',
  source: 'rightmove',
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
  provenance: { address: 'adapter' },
};

const manualListing: PropertyListing = {
  ...sampleListing,
  source: 'manual',
  url: '',
  listingId: '',
};

function makeRow(overrides: Partial<AgentListingRow>): AgentListingRow {
  return {
    id: 'L1',
    organisation_id: 'ag',
    slug: null,
    status: 'draft',
    source: 'rightmove',
    source_url: null,
    agent_url: null,
    listing: sampleListing,
    provenance: {},
    material_info: {} as AgentListingRow['material_info'],
    transaction_id: null,
    published_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderPage(): ReturnType<typeof render> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ListingCreatePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ListingCreatePage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockCreate.mockReset();
    mockUseEstateAgentOrg.mockReturnValue({ organisationId: 'ag', organisationName: null, isLoading: false, isError: false });
  });

  it('creates a listing from a scraped import and navigates to it', async () => {
    mockCreate.mockResolvedValue(makeRow({ id: 'L1' }));
    renderPage();

    fireEvent.click(screen.getByText('mock-import'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        organisation_id: 'ag',
        source: 'rightmove',
        source_url: sampleListing.url,
        listing: sampleListing,
        provenance: sampleListing.provenance,
      });
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/estate-agent/listings/L1');
    });
  });

  it('creates a listing from the manual tab and navigates to it', async () => {
    mockCreate.mockResolvedValue(makeRow({ id: 'L1', source: 'manual' }));
    renderPage();

    fireEvent.click(screen.getByText('Enter details manually'));
    fireEvent.click(screen.getByText('mock-save'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        organisation_id: 'ag',
        source: 'manual',
        source_url: null,
        listing: manualListing,
        provenance: {},
      });
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/estate-agent/listings/L1');
    });
  });

  it('shows the unlinked-account state when there is no organisation', () => {
    mockUseEstateAgentOrg.mockReturnValue({ organisationId: null, organisationName: null, isLoading: false, isError: false });
    renderPage();
    expect(screen.queryByText('mock-import')).not.toBeInTheDocument();
    expect(screen.getByText(/isn't linked/i)).toBeInTheDocument();
  });

  it('shows a loading state while the org membership is still loading, not the unlinked message', () => {
    mockUseEstateAgentOrg.mockReturnValue({ organisationId: null, organisationName: null, isLoading: true, isError: false });
    renderPage();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByText(/isn't linked/i)).not.toBeInTheDocument();
  });
});
