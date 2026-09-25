import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import { Section15 } from '../Section15';
import { emptyTA6Form, emptyDocument } from '../../../../types/ta6.defaults';
import type { TA6Section15AdditionalInfo } from '../../../../types/ta6.types';

const emptySection = (): TA6Section15AdditionalInfo => emptyTA6Form().section15;

describe('Section15', () => {
  it('should render the consent block, the three consent lists and the additional notes field', () => {
    // Arrange / Act
    render(<Section15 value={emptySection()} onChange={() => {}} readOnly={false} />);

    // Assert
    ['15.1', '15.1.attached', '15.1.to-follow', '15.1.not-available', '15.notes'].forEach((ref) =>
      expect(screen.getByText(ref)).toBeInTheDocument(),
    );
  });

  it('should append an empty consent slot when Add consent is clicked', () => {
    // Arrange
    const onChange = vi.fn();
    render(<Section15 value={emptySection()} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: /add consent/i }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...emptySection(),
      q15_1ConsentsAttached: [emptyDocument()],
    });
  });

  it('should render an open ghost consent slot before any consent is added', () => {
    // Arrange
    const onChange = vi.fn();

    // Act
    render(<Section15 value={emptySection()} onChange={onChange} readOnly={false} />);

    // Assert — slot 1 is open, the ghost cannot be removed,
    // and nothing is written to form state until the user answers it
    expect(screen.getByRole('group', { name: '15.1.1 document status' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove consent 1' })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should materialise the ghost consent as a one-element array when a status is chosen', () => {
    // Arrange
    const onChange = vi.fn();
    render(<Section15 value={emptySection()} onChange={onChange} readOnly={false} />);

    // Act
    const group = screen.getByRole('group', { name: '15.1.1 document status' });
    fireEvent.click(within(group).getByRole('button', { name: 'To follow' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...emptySection(),
      q15_1ConsentsAttached: [{ status: 'to-follow', documentId: null }],
    });
  });

  it('should update the matching consent slot when a status is chosen on one row', () => {
    // Arrange
    const onChange = vi.fn();
    const value: TA6Section15AdditionalInfo = {
      ...emptySection(),
      q15_1ConsentsAttached: [emptyDocument(), emptyDocument()],
    };
    render(<Section15 value={value} onChange={onChange} readOnly={false} />);

    // Act — second row gets 'to-follow'; first row must be untouched
    const group = screen.getByRole('group', { name: '15.1.2 document status' });
    fireEvent.click(within(group).getByRole('button', { name: 'To follow' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q15_1ConsentsAttached: [emptyDocument(), { status: 'to-follow', documentId: null }],
    });
  });

  it('should remove the matching consent row when its remove button is clicked', () => {
    // Arrange
    const onChange = vi.fn();
    const kept = { status: 'to-follow' as const, documentId: null };
    const value: TA6Section15AdditionalInfo = {
      ...emptySection(),
      q15_1ConsentsAttached: [emptyDocument(), kept],
    };
    render(<Section15 value={value} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Remove consent 1' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({ ...value, q15_1ConsentsAttached: [kept] });
  });

  it('should report typed text on the to-follow list', () => {
    // Arrange
    const onChange = vi.fn();
    render(<Section15 value={emptySection()} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.change(screen.getByLabelText('15.1.to-follow text'), {
      target: { value: 'FENSA certificate for 2019 windows' },
    });

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...emptySection(),
      consentsToFollowList: 'FENSA certificate for 2019 windows',
    });
  });

  it('should map an emptied additional notes textarea to null to mirror the on-chain optional', () => {
    // Arrange
    const onChange = vi.fn();
    const value: TA6Section15AdditionalInfo = {
      ...emptySection(),
      additionalNotes: 'Boiler serviced annually',
    };
    render(<Section15 value={value} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.change(screen.getByLabelText('15.notes text'), { target: { value: '' } });

    // Assert
    expect(onChange).toHaveBeenCalledWith({ ...value, additionalNotes: null });
  });

  it('should hide add and remove controls and disable the textareas when readOnly', () => {
    // Arrange / Act
    const value: TA6Section15AdditionalInfo = {
      ...emptySection(),
      q15_1ConsentsAttached: [emptyDocument()],
    };
    render(<Section15 value={value} onChange={() => {}} readOnly />);

    // Assert
    expect(screen.queryByRole('button', { name: /add consent/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove consent 1' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('15.notes text')).toBeDisabled();
  });
});
