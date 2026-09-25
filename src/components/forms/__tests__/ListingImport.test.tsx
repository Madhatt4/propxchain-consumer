import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ListingImport from '../ListingImport';
import type { PropertyListing, ProvenanceMap } from '@/types/listing.types';

vi.mock('@/services/listing.service', () => ({
  scrapeListing: vi.fn(),
  isValidListingUrl: (u: string) => /^https?:/.test(u),
  formatPrice: (n: number) => `£${n.toLocaleString('en-GB')}`,
}));

import { scrapeListing } from '@/services/listing.service';

const fullListing: PropertyListing = {
  url: 'https://villageagent.co.uk/1', listingId: '', source: 'llm',
  address: '1 High St', postcode: 'SG18 8AB', price: 425000, propertyType: 'house',
  bedrooms: 3, tenure: 'freehold', priceQualifier: '', bathrooms: 2,
  description: '', keyFeatures: [], images: [], floorplanUrl: null,
  epcRating: null, agentName: '', agentBranch: '', agentLogoUrl: null,
  councilTaxBand: null, propertyPhrase: '', provenance: {} as ProvenanceMap,
};

const fullProv: ProvenanceMap = {
  listingId: 'missing', source: 'llm', address: 'llm', postcode: 'llm', price: 'llm',
  propertyType: 'llm', bedrooms: 'llm', tenure: 'llm', priceQualifier: 'missing',
  bathrooms: 'llm', description: 'missing', keyFeatures: 'missing', images: 'missing',
  floorplanUrl: 'missing', epcRating: 'missing', agentName: 'missing',
  agentBranch: 'missing', agentLogoUrl: 'missing', councilTaxBand: 'missing',
  propertyPhrase: 'missing',
};

const partialProv: ProvenanceMap = { ...fullProv, postcode: 'missing', tenure: 'missing' };

describe('ListingImport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('imports URL via button and calls onImport on Use This Property', async () => {
    (scrapeListing as any).mockResolvedValue({ listing: fullListing, provenance: fullProv });
    const onImport = vi.fn();
    render(<ListingImport onImport={onImport} />);

    fireEvent.change(screen.getByPlaceholderText(/paste/i), { target: { value: 'https://villageagent.co.uk/1' } });
    fireEvent.click(screen.getByText('Import'));
    await waitFor(() => screen.getByText('Use This Property'));

    fireEvent.click(screen.getByText('Use This Property'));
    expect(onImport).toHaveBeenCalledWith(fullListing);
  });

  it('shows required-fields banner when fields missing and disables Use This Property', async () => {
    (scrapeListing as any).mockResolvedValue({
      listing: { ...fullListing, postcode: '', tenure: 'unknown' },
      provenance: partialProv,
    });
    render(<ListingImport onImport={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/paste/i), { target: { value: 'https://x' } });
    fireEvent.click(screen.getByText('Import'));

    await waitFor(() => screen.getByText(/couldn't find/i));
    expect(screen.getByText(/postcode/i)).toBeInTheDocument();
    expect(screen.getByText(/tenure/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /complete required fields/i })).toBeDisabled();
  });

  it('Edit details opens edit form, saves, and re-shows preview', async () => {
    (scrapeListing as any).mockResolvedValue({
      listing: { ...fullListing, postcode: '', tenure: 'unknown' },
      provenance: partialProv,
    });
    render(<ListingImport onImport={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/paste/i), { target: { value: 'https://x' } });
    fireEvent.click(screen.getByText('Import'));

    await waitFor(() => screen.getByText('Edit details'));
    fireEvent.click(screen.getByText('Edit details'));
    fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: 'SG18 8AB' } });
    fireEvent.change(screen.getByLabelText('Tenure'), { target: { value: 'freehold' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => screen.getByText('SG18 8AB'));
    expect(screen.getByRole('button', { name: /use this property/i })).not.toBeDisabled();
  });

  it('accepts a flat address with no structured addressLine1/town (Rightmove import shape)', async () => {
    // Regression: REQUIRED_FIELDS previously demanded addressLine1 + town,
    // which neither the Rightmove adapter nor the edit form populate. The
    // warning fired on every URL import even though the UI shows the address.
    const rightmoveLike: PropertyListing = {
      ...fullListing,
      address: 'Brickhill Road, Sandy',
      addressLine1: undefined,
      town: undefined,
    };
    const rightmoveProv: ProvenanceMap = {
      ...fullProv,
      address: 'adapter',
      addressLine1: 'missing',
      town: 'missing',
    };
    (scrapeListing as any).mockResolvedValue({ listing: rightmoveLike, provenance: rightmoveProv });
    render(<ListingImport onImport={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/paste/i), { target: { value: 'https://rm/1' } });
    fireEvent.click(screen.getByText('Import'));

    await waitFor(() => screen.getByText('Use This Property'));
    expect(screen.queryByText(/couldn't find/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /use this property/i })).not.toBeDisabled();
  });

  it('shows error message when scrapeListing throws', async () => {
    (scrapeListing as any).mockRejectedValue(new Error('You\'ve hit the import limit. Try again in an hour.'));
    render(<ListingImport onImport={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/paste/i), { target: { value: 'https://x' } });
    fireEvent.click(screen.getByText('Import'));
    await waitFor(() => screen.getByText(/import limit/i));
  });
});
