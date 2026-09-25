import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PropertyDetailsForm, type PropertyDetailsValue } from '../PropertyDetailsForm';

// A fully-valid form value (all required fields satisfied) so that the only
// thing standing between the user and a save is the UPRN under test.
const validBase: PropertyDetailsValue = {
  addressLine1: '12 High Street',
  town: 'Sandy',
  postcode: 'SG19 1AB',
  titleNumber: 'BD123456',
  price: 425000,
  tenure: 'freehold',
};

function renderForm(uprn: string) {
  const onSave = vi.fn();
  const onChange = vi.fn();
  render(
    <PropertyDetailsForm
      value={{ ...validBase, uprn }}
      onChange={onChange}
      onSave={onSave}
      saveLabel="Save"
    />,
  );
  return { onSave };
}

describe('PropertyDetailsForm — UPRN validation', () => {
  it('blocks save and shows a field-specific error for a malformed UPRN', () => {
    const { onSave } = renderForm('12A45');
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/UPRN \(must be 1/)).toBeInTheDocument();
  });

  it('blocks save for a UPRN longer than 12 digits', () => {
    const { onSave } = renderForm('1234567890123');
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/UPRN \(must be 1/)).toBeInTheDocument();
  });

  it('saves when the UPRN is a valid 1–12 digit number', () => {
    const { onSave } = renderForm('100023336956');
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('saves when the UPRN is left blank (optional field)', () => {
    const { onSave } = renderForm('');
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('renders the UPRN field with explainer microcopy and a finder link', () => {
    renderForm('');
    expect(screen.getByText(/Find my UPRN/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Find my UPRN/i });
    expect(link).toHaveAttribute('href', 'https://www.findmyaddress.co.uk/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
