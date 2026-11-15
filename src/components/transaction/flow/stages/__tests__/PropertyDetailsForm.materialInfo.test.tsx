// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Stage 1 cannot be completed while the Sales pack would still report
 * "About your property" as missing: both read materialInfoMissing. Before
 * 2026-11-15 a seller could confirm the listing with no council tax band or
 * property type, leaving the pack row unticked with a button back to Stage 1.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PropertyDetailsForm, type PropertyDetailsValue } from '../PropertyDetailsForm';

const complete: PropertyDetailsValue = {
  addressLine1: '12 High Street',
  town: 'Sandy',
  postcode: 'SG19 1AB',
  titleNumber: 'BD123456',
  price: 425000,
  tenure: 'freehold',
  propertyType: 'Detached',
  councilTaxBand: 'D',
};

function submit(value: PropertyDetailsValue): ReturnType<typeof vi.fn> {
  const onSave = vi.fn();
  render(<PropertyDetailsForm value={value} onChange={vi.fn()} onSave={onSave} saveLabel="Confirm Listing & Continue" />);
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Listing & Continue' }));
  return onSave;
}

describe('PropertyDetailsForm material information gate', () => {
  it('should complete when every material field is present', () => {
    expect(submit(complete)).toHaveBeenCalledTimes(1);
  });

  it('should block completion without a council tax band and say so', () => {
    const onSave = submit({ ...complete, councilTaxBand: undefined });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Please complete: Council tax band/)).toBeInTheDocument();
  });

  it('should block completion without a property type and say so', () => {
    const onSave = submit({ ...complete, propertyType: undefined });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Please complete: Property type/)).toBeInTheDocument();
  });

  it('should block a leasehold listing until the lease trio is filled', () => {
    const onSave = submit({ ...complete, tenure: 'leasehold' });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Lease years remaining, Ground rent \(£\/yr\), Service charge \(£\/yr\)/)).toBeInTheDocument();
  });

  it('should accept a peppercorn (zero) ground rent', () => {
    const onSave = submit({
      ...complete, tenure: 'leasehold', leaseYearsRemaining: 95, groundRentPerYear: 0, serviceChargePerYear: 1200,
    });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('should mark property type and council tax band as required and offer Welsh band I', () => {
    render(<PropertyDetailsForm value={complete} onChange={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByText('Property type').parentElement).toHaveTextContent('Property type*');
    expect(screen.getByText('Council tax band').parentElement).toHaveTextContent('Council tax band*');
    const bands = Array.from(screen.getByLabelText(/Council tax band/).querySelectorAll('option')).map((o) => o.textContent);
    expect(bands).toContain('I');
  });
});
