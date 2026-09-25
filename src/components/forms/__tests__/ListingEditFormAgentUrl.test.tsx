// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

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

const FIELD = 'This property on your website';

describe('ListingEditForm — agency listing URL', () => {
  it('should not render the field when the caller keeps no agency URL', () => {
    // The seller-side import flow has no agency site to link to, and it must
    // keep working with the two-argument onSave it already passes.
    render(<ListingEditForm listing={baseListing} onSave={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByLabelText(FIELD)).not.toBeInTheDocument();
  });

  it('should report undefined, not null, when it is not managing the field', () => {
    // The regression this guards: returning `null` reads downstream as "the
    // agent cleared it", so any surface that saves without showing the field
    // would blank an agency's saved URL. `undefined` means "not mine to touch".
    const onSave = vi.fn();
    render(<ListingEditForm listing={baseListing} onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Address'), { target: { value: '2 Oak Rd' } });
    fireEvent.click(screen.getByText('Save'));

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0][2]).toBeUndefined();
  });

  it('should render the field when the caller passes agentUrl, even as null', () => {
    render(<ListingEditForm listing={baseListing} agentUrl={null} onSave={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByLabelText(FIELD)).toHaveValue('');
  });

  it('should prefill an existing URL', () => {
    render(
      <ListingEditForm
        listing={baseListing}
        agentUrl="https://demoandsons.co.uk/45"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(FIELD)).toHaveValue('https://demoandsons.co.uk/45');
  });

  it('should save a bare host as https rather than making the agent type a scheme', () => {
    const onSave = vi.fn();
    render(<ListingEditForm listing={baseListing} agentUrl={null} onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(FIELD), {
      target: { value: 'demoandsons.co.uk/45-laburnum-road' },
    });
    fireEvent.click(screen.getByText('Save'));

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0][2]).toBe('https://demoandsons.co.uk/45-laburnum-road');
  });

  it('should save null when the field is cleared, so the button can be removed', () => {
    const onSave = vi.fn();
    render(
      <ListingEditForm
        listing={baseListing}
        agentUrl="https://demoandsons.co.uk/45"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(FIELD), { target: { value: '' } });
    fireEvent.click(screen.getByText('Save'));

    expect(onSave.mock.calls[0][2]).toBeNull();
  });

  it('should block the whole save on an invalid URL rather than silently dropping it', () => {
    const onSave = vi.fn();
    render(<ListingEditForm listing={baseListing} agentUrl={null} onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(FIELD), { target: { value: 'javascript:alert(1)' } });
    fireEvent.click(screen.getByText('Save'));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Enter a web address/)).toBeInTheDocument();
    expect(screen.getByLabelText(FIELD)).toHaveAttribute('aria-invalid', 'true');
  });

  it('should clear the error once the agent starts correcting it', () => {
    render(<ListingEditForm listing={baseListing} agentUrl={null} onSave={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(FIELD), { target: { value: 'nope!!' } });
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByText(/Enter a web address/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(FIELD), { target: { value: 'demoandsons.co.uk' } });
    expect(screen.queryByText(/Enter a web address/)).not.toBeInTheDocument();
  });

  it('should still pass the edited listing and provenance through unchanged', () => {
    const onSave = vi.fn();
    render(<ListingEditForm listing={baseListing} agentUrl={null} onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Address'), { target: { value: '2 Oak Rd' } });
    fireEvent.click(screen.getByText('Save'));

    const [updated, provenance] = onSave.mock.calls[0];
    expect(updated.address).toBe('2 Oak Rd');
    expect(provenance.address).toBe('user');
  });
});
