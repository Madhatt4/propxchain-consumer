import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ListingPreviewCard from '../ListingPreviewCard';
import type { PropertyListing, ProvenanceMap } from '@/types/listing.types';

const baseListing: PropertyListing = {
  url: 'https://example.com/x',
  listingId: '',
  source: 'llm',
  address: '1 High St',
  postcode: 'SG18 8AB',
  price: 425000,
  propertyType: 'house',
  bedrooms: 3,
  tenure: 'freehold',
  priceQualifier: '',
  bathrooms: 2,
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
  provenance: {} as ProvenanceMap,
};

const llmProvenance: ProvenanceMap = {
  listingId: 'missing', source: 'llm', address: 'llm', postcode: 'llm',
  price: 'llm', propertyType: 'llm', bedrooms: 'llm', tenure: 'llm',
  priceQualifier: 'missing', bathrooms: 'llm', description: 'missing',
  keyFeatures: 'missing', images: 'missing', floorplanUrl: 'missing',
  epcRating: 'missing', agentName: 'missing', agentBranch: 'missing',
  agentLogoUrl: 'missing', councilTaxBand: 'missing', propertyPhrase: 'missing',
};

describe('ListingPreviewCard', () => {
  it('renders price, address, postcode', () => {
    render(<ListingPreviewCard listing={baseListing} provenance={llmProvenance} />);
    expect(screen.getByText(/£425,000/)).toBeInTheDocument();
    expect(screen.getByText('1 High St')).toBeInTheDocument();
    expect(screen.getByText('SG18 8AB')).toBeInTheDocument();
  });

  it('shows Auto-extracted badge when source is llm', () => {
    const withImage = { ...baseListing, images: [{ url: 'https://x/a.jpg', caption: 'front' }] };
    render(<ListingPreviewCard listing={withImage} provenance={llmProvenance} />);
    expect(screen.getByText('Auto-extracted from site')).toBeInTheDocument();
  });

  it('shows portal badge for Rightmove', () => {
    const withImage = { ...baseListing, source: 'rightmove' as const, images: [{ url: 'https://x/a.jpg', caption: 'front' }] };
    render(<ListingPreviewCard listing={withImage} provenance={llmProvenance} />);
    expect(screen.getByText('Rightmove')).toBeInTheDocument();
  });

  it('shows "Price missing" when price is 0', () => {
    render(<ListingPreviewCard listing={{ ...baseListing, price: 0 }} provenance={llmProvenance} />);
    expect(screen.getByText('Price missing')).toBeInTheDocument();
  });

  // Regression 2026-08-31: pasting a Rightmove URL tripped the global
  // ErrorBoundary ("Something went wrong"). The worker's mergeListings treats
  // an empty array as "not present" and omits the key entirely, so a listing
  // with no key features arrives as `keyFeatures: undefined` — not `[]`. The
  // fixture above hardcoded both arrays as present, which is why the suite
  // stayed green while production crashed. `as unknown as PropertyListing` is
  // deliberate: the declared type promises arrays the wire format does not.
  describe('when the worker omits array fields entirely (the real wire shape)', () => {
    const withoutArrays = (): PropertyListing => {
      const partial = { ...baseListing };
      delete (partial as Partial<PropertyListing>).images;
      delete (partial as Partial<PropertyListing>).keyFeatures;
      return partial as unknown as PropertyListing;
    };

    it('should render without throwing when images and keyFeatures are absent', () => {
      expect(() =>
        render(<ListingPreviewCard listing={withoutArrays()} provenance={llmProvenance} />),
      ).not.toThrow();
      expect(screen.getByText('1 High St')).toBeInTheDocument();
    });

    it('should still render the listing body when only keyFeatures is absent', () => {
      const partial = {
        ...baseListing,
        source: 'rightmove' as const,
        images: [{ url: 'https://x/a.jpg', caption: 'front' }],
      };
      delete (partial as Partial<PropertyListing>).keyFeatures;
      expect(() =>
        render(<ListingPreviewCard listing={partial as unknown as PropertyListing} provenance={llmProvenance} />),
      ).not.toThrow();
      expect(screen.getByText('Rightmove')).toBeInTheDocument();
    });
  });
});
