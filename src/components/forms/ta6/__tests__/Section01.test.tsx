import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { Section01 } from '../Section01';
import { emptyTA6Form } from '../../../../types/ta6.types';

const ADDRESS_LABEL = 'Full address of the property being sold';

describe('Section01', () => {
  it('should render the address, postcode and UPRN fields from an empty section 1 slice', () => {
    // Arrange / Act
    render(
      <Section01 value={emptyTA6Form().section1} onChange={() => {}} readOnly={false} />,
    );

    // Assert
    expect(screen.getByLabelText(ADDRESS_LABEL)).toHaveValue('');
    expect(screen.getByLabelText('Postcode of the property')).toHaveValue('');
    expect(
      screen.getByLabelText('Unique Property Reference Number (UPRN), if you know it'),
    ).toHaveValue('');
  });

  it('should call onChange with the typed property address', () => {
    // Arrange
    const onChange = vi.fn();
    const value = emptyTA6Form().section1;
    render(<Section01 value={value} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.change(screen.getByLabelText(ADDRESS_LABEL), {
      target: { value: '1 Acacia Avenue, Sandy' },
    });

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      propertyAddress: '1 Acacia Avenue, Sandy',
    });
  });

  it('should render an open ghost seller row with empty values before any seller is added', () => {
    // Arrange / Act
    render(
      <Section01 value={emptyTA6Form().section1} onChange={() => {}} readOnly={false} />,
    );

    // Assert — the row is ready to type into, but is not deletable until real
    expect(screen.getByLabelText('Full name')).toHaveValue('');
    expect(screen.getByLabelText('Capacity')).toHaveValue('seller');
    expect(screen.getByLabelText('Ownership / authority date')).toHaveValue('');
    expect(screen.queryByRole('button', { name: /remove seller/i })).not.toBeInTheDocument();
  });

  it('should materialise the ghost row as a one-element sellers array on the first keystroke', () => {
    // Arrange
    const onChange = vi.fn();
    const value = emptyTA6Form().section1;
    render(<Section01 value={value} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.change(screen.getByLabelText('Full name'), {
      target: { value: 'Marjorie Dawes' },
    });

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      sellers: [{ fullName: 'Marjorie Dawes', role: 'seller', ownershipOrAuthorityDate: null }],
    });
  });

  it('should append an empty seller row defaulting to the owner role when Add seller is clicked', () => {
    // Arrange
    const onChange = vi.fn();
    const value = emptyTA6Form().section1;
    render(<Section01 value={value} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: /add seller/i }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      sellers: [{ fullName: '', role: 'seller', ownershipOrAuthorityDate: null }],
    });
  });

  it('should add an empty company seller block when the company button is clicked', () => {
    // Arrange
    const onChange = vi.fn();
    const value = emptyTA6Form().section1;
    render(<Section01 value={value} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: /seller is a company/i }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      sellerCompany: {
        companyName: '',
        companyNumber: '',
        director: '',
        countryOfIncorporation: '',
      },
    });
  });

  it('should call onChange with the typed solicitor firm name', () => {
    // Arrange
    const onChange = vi.fn();
    const value = emptyTA6Form().section1;
    render(<Section01 value={value} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.change(screen.getByLabelText('Firm name'), {
      target: { value: 'Sandy Conveyancing LLP' },
    });

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      solicitor: { ...value.solicitor, firmName: 'Sandy Conveyancing LLP' },
    });
  });

  it('should hide the add-seller and company buttons when readOnly', () => {
    // Arrange / Act
    render(<Section01 value={emptyTA6Form().section1} onChange={() => {}} readOnly />);

    // Assert — no ghost row either: readOnly renders saved data only
    expect(screen.queryByRole('button', { name: /add seller/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /seller is a company/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(ADDRESS_LABEL)).toBeDisabled();
    expect(screen.queryByLabelText('Full name')).not.toBeInTheDocument();
  });
});
