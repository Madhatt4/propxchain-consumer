import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import { Section13 } from '../Section13';
import { emptyTA6Form, emptyDocument } from '../../../../types/ta6.defaults';
import type { TA6Occupier, TA6Section13Transaction } from '../../../../types/ta6.types';

const emptySection = (): TA6Section13Transaction => emptyTA6Form().section13;

const occupier = (overrides: Partial<TA6Occupier> = {}): TA6Occupier => ({
  fullName: 'Jo Bloggs',
  age: 34,
  tenancyAgreement: emptyDocument(),
  ...overrides,
});

describe('Section13', () => {
  it('should render every fixed §13 question ref and hide the occupier editor while drafting', () => {
    // Arrange / Act
    render(<Section13 value={emptySection()} onChange={() => {}} readOnly={false} />);

    // Assert — 13.1..13.6 rendered; 13.7 gated behind vacant possession = no
    ['13.1', '13.2', '13.3', '13.4', '13.4b', '13.5', '13.6'].forEach((ref) =>
      expect(screen.getByText(ref)).toBeInTheDocument(),
    );
    expect(screen.queryByText('13.7')).not.toBeInTheDocument();
  });

  it('should call onChange with a yes answer when Yes is clicked on 13.3', () => {
    // Arrange
    const onChange = vi.fn();
    render(<Section13 value={emptySection()} onChange={onChange} readOnly={false} />);

    // Act
    const group = screen.getByRole('group', { name: '13.3 answer' });
    fireEvent.click(within(group).getByRole('button', { name: 'Yes' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({ ...emptySection(), q13_3SellerLivesAtProperty: 'yes' });
  });

  it('should constrain 13.5 to yes and no only, per the form', () => {
    // Arrange / Act
    render(<Section13 value={emptySection()} onChange={() => {}} readOnly={false} />);

    // Assert
    const group = screen.getByRole('group', { name: '13.5 answer' });
    expect(within(group).getByRole('button', { name: 'Yes' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'No' })).toBeInTheDocument();
    expect(within(group).queryByRole('button', { name: 'Not known' })).not.toBeInTheDocument();
  });

  it('should show the occupier editor and append an empty row when vacant possession is no', () => {
    // Arrange
    const onChange = vi.fn();
    const value: TA6Section13Transaction = { ...emptySection(), q13_5VacantPossession: 'no' };
    render(<Section13 value={value} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: /add occupier/i }));

    // Assert
    expect(screen.getByText('13.7')).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q13_7Occupiers: [{ fullName: '', age: null, tenancyAgreement: emptyDocument() }],
    });
  });

  it('should render an open ghost occupier row before any occupier is added', () => {
    // Arrange
    const onChange = vi.fn();
    const value: TA6Section13Transaction = { ...emptySection(), q13_5VacantPossession: 'no' };

    // Act
    render(<Section13 value={value} onChange={onChange} readOnly={false} />);

    // Assert — row 1 is open and empty, the ghost cannot be removed,
    // and nothing is written to form state until the user types
    expect(screen.getByLabelText('Full name')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Remove occupier 1' })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should materialise the ghost occupier as a one-element array on first keystroke', () => {
    // Arrange
    const onChange = vi.fn();
    const value: TA6Section13Transaction = { ...emptySection(), q13_5VacantPossession: 'no' };
    render(<Section13 value={value} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Jo Bloggs' } });

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q13_7Occupiers: [{ fullName: 'Jo Bloggs', age: null, tenancyAgreement: emptyDocument() }],
    });
  });

  it('should update the edited occupier name and leave other rows untouched', () => {
    // Arrange
    const onChange = vi.fn();
    const rows = [occupier(), occupier({ fullName: 'Sam Smith', age: null })];
    const value: TA6Section13Transaction = {
      ...emptySection(),
      q13_5VacantPossession: 'no',
      q13_7Occupiers: rows,
    };
    render(<Section13 value={value} onChange={onChange} readOnly={false} />);

    // Act
    const [firstName] = screen.getAllByLabelText('Full name');
    fireEvent.change(firstName, { target: { value: 'Jo Bloggs-Jones' } });

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q13_7Occupiers: [occupier({ fullName: 'Jo Bloggs-Jones' }), rows[1]],
    });
  });

  it('should remove the matching occupier row when its remove button is clicked', () => {
    // Arrange
    const onChange = vi.fn();
    const rows = [occupier(), occupier({ fullName: 'Sam Smith' })];
    const value: TA6Section13Transaction = {
      ...emptySection(),
      q13_5VacantPossession: 'no',
      q13_7Occupiers: rows,
    };
    render(<Section13 value={value} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Remove occupier 1' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({ ...value, q13_7Occupiers: [rows[1]] });
  });

  it('should keep existing occupier rows visible even when vacant possession flips to yes', () => {
    // Arrange — saved data must never be hidden by an answer change
    const value: TA6Section13Transaction = {
      ...emptySection(),
      q13_5VacantPossession: 'yes',
      q13_7Occupiers: [occupier()],
    };

    // Act
    render(<Section13 value={value} onChange={() => {}} readOnly={false} />);

    // Assert
    expect(screen.getByText('13.7')).toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toHaveValue('Jo Bloggs');
  });

  it('should hide add and remove controls when readOnly', () => {
    // Arrange / Act
    const value: TA6Section13Transaction = {
      ...emptySection(),
      q13_5VacantPossession: 'no',
      q13_7Occupiers: [occupier()],
    };
    render(<Section13 value={value} onChange={() => {}} readOnly />);

    // Assert
    expect(screen.queryByRole('button', { name: /add occupier/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove occupier 1' })).not.toBeInTheDocument();
  });
});
