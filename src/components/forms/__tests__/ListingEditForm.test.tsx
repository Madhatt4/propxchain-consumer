import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ListingEditForm from '../ListingEditForm';
import type { PropertyListing, ProvenanceMap } from '@/types/listing.types';

const baseListing: PropertyListing = {
  url: 'https://x', listingId: '', source: 'llm',
  address: '', postcode: '', price: 0, propertyType: '', bedrooms: 0, tenure: 'unknown',
  priceQualifier: '', bathrooms: 0, description: '', keyFeatures: [], images: [],
  floorplanUrl: null, epcRating: null, agentName: '', agentBranch: '',
  agentLogoUrl: null, councilTaxBand: null, propertyPhrase: '',
  provenance: {} as ProvenanceMap,
};

describe('ListingEditForm', () => {
  it('prefills values from listing', () => {
    const l = { ...baseListing, address: '1 High St', price: 425000 };
    render(<ListingEditForm listing={l} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('Address')).toHaveValue('1 High St');
    expect(screen.getByLabelText('Price (£)')).toHaveValue(425000);
  });

  it('calls onSave with edited values and user provenance for changed fields', () => {
    const onSave = vi.fn();
    render(<ListingEditForm listing={baseListing} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Address'), { target: { value: '2 Oak Rd' } });
    fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: 'SG18 8AB' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledOnce();
    const [updated, newProvenance] = onSave.mock.calls[0];
    expect(updated.address).toBe('2 Oak Rd');
    expect(updated.postcode).toBe('SG18 8AB');
    expect(newProvenance.address).toBe('user');
    expect(newProvenance.postcode).toBe('user');
  });

  it('calls onCancel without invoking onSave', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(<ListingEditForm listing={baseListing} onSave={onSave} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });
});
