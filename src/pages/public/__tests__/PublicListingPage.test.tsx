// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropertyListing } from '@/types/listing.types';
import type { PublicListingRecord } from '@/services/estateAgentListings.service';

vi.mock('@/services/estateAgentListings.service', () => ({
  estateAgentListingsService: {
    getPublicBySlug: vi.fn(),
  },
}));

import { estateAgentListingsService } from '@/services/estateAgentListings.service';
import PublicListingPage from '../PublicListingPage';

const mockGetPublicBySlug = vi.mocked(estateAgentListingsService.getPublicBySlug);

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
    description: 'A lovely terraced home close to the town centre.',
    keyFeatures: ['Off-street parking', 'South-facing garden'],
    images: [{ url: 'https://media.rightmove.co.uk/1.jpg', caption: 'Front elevation' }],
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

function makeRecord(overrides: Partial<PublicListingRecord>): PublicListingRecord {
  return {
    slug: 'acme-homes-sg19-abc123',
    status: 'for_sale',
    listing: baseListing({}),
    material_info: {
      price: { value: 250000, source: 'listing' },
      tenure: { value: 'freehold', source: 'listing' },
      councilTaxBand: { value: 'D', source: 'agent' },
      epcRating: { value: null, source: 'missing' },
      epcFloorAreaSqm: { value: null, source: 'missing' },
      leaseYearsRemaining: { value: null, source: 'missing' },
      groundRentPerYear: { value: null, source: 'missing' },
      serviceChargePerYear: { value: null, source: 'missing' },
      floodRisk: { value: null, source: 'missing' },
      conservationArea: { value: null, source: 'missing' },
      listedBuilding: { value: null, source: 'missing' },
    },
    published_at: '2026-08-01T00:00:00.000Z',
    agency_name: 'Acme Homes',
    agency_branch: 'Sandy',
    ...overrides,
  };
}

function renderPage(slug = 'acme-homes-sg19-abc123'): ReturnType<typeof render> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/property/${slug}`]}>
        <Routes>
          <Route path="/property/:slug" element={<PublicListingPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PublicListingPage', () => {
  beforeEach(() => {
    mockGetPublicBySlug.mockReset();
  });

  it('renders a for_sale listing with material info before the description, agency card, and JSON-LD', async () => {
    mockGetPublicBySlug.mockResolvedValue(makeRecord({}));
    renderPage();

    expect(await screen.findByRole('heading', { name: '1 High St, Sandy', level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText('£250,000').length).toBeGreaterThan(0);
    expect(screen.getByText(/3 bed/i)).toBeInTheDocument();

    const materialInfoHeading = screen.getByRole('heading', { name: /material information/i });
    const descriptionText = screen.getByText('A lovely terraced home close to the town centre.');
    // eslint-disable-next-line no-bitwise
    expect(
      materialInfoHeading.compareDocumentPosition(descriptionText) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(screen.getByText(/contact acme homes, sandy/i)).toBeInTheDocument();

    const script = document.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    const parsed = JSON.parse(script!.textContent ?? '{}') as { '@type': string };
    expect(parsed['@type']).toBe('RealEstateListing');

    expect(document.body.innerHTML).not.toContain('transaction_id');
  });

  it('shows a status ribbon for a sold_stc listing and no Enquire link', async () => {
    mockGetPublicBySlug.mockResolvedValue(makeRecord({ status: 'sold_stc' }));
    renderPage();

    expect(await screen.findByText('Sold STC')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /enquire/i })).not.toBeInTheDocument();
  });

  it('shows a not-available message and a link home when the record is null', async () => {
    mockGetPublicBySlug.mockResolvedValue(null);
    renderPage();

    expect(await screen.findByText(/this property isn.t available/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /home|propxchain/i });
    expect(link).toHaveAttribute('href', '/');
  });

  it('escapes a </script> breakout attempt in the JSON-LD payload', async () => {
    const maliciousAddress = '1 High St</script><img src=x onerror=alert(1)>';
    mockGetPublicBySlug.mockResolvedValue(
      makeRecord({ listing: baseListing({ address: maliciousAddress }) }),
    );
    renderPage();

    await screen.findByText(/contact acme homes, sandy/i);

    const script = document.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    expect(script!.textContent).not.toContain('</script>');
    const parsed = JSON.parse(script!.textContent ?? '{}') as { name: string };
    expect(parsed.name).toBe(maliciousAddress);

    expect(document.body.innerHTML).not.toContain('</script><img');
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });
});
