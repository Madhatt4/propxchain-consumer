import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PropertyListing, ProvenanceMap } from '@/types/listing.types';
import { PropertyListingCard } from '../PropertyListingCard';

const baseListing: PropertyListing = {
  url: '',
  listingId: 'manual-1',
  source: 'manual',
  address: '12 High Street, Sandy',
  postcode: 'SG19 1AB',
  price: 425000,
  propertyType: 'Detached',
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

describe('PropertyListingCard — UPRN line', () => {
  it('renders the UPRN when present', () => {
    render(<PropertyListingCard listing={{ ...baseListing, uprn: '100023336956' }} />);
    expect(screen.getByText('100023336956')).toBeInTheDocument();
    expect(screen.getByText('UPRN')).toBeInTheDocument();
  });

  it('does not render a UPRN line when absent', () => {
    render(<PropertyListingCard listing={baseListing} />);
    expect(screen.queryByText('UPRN')).not.toBeInTheDocument();
  });
});
