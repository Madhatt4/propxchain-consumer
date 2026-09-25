import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import { Section02 } from '../Section02';
import { emptyTA6Form } from '../../../../types/ta6.types';

describe('Section02', () => {
  it('should render the 2.1, 2.2 and 2.3 question refs with an open ghost boundary row', () => {
    // Arrange / Act
    render(
      <Section02 value={emptyTA6Form().section2} onChange={() => {}} readOnly={false} />,
    );

    // Assert — the first row sits open without a click, at the add defaults
    expect(screen.getByText('2.1')).toBeInTheDocument();
    expect(screen.getByText('2.2')).toBeInTheDocument();
    expect(screen.getByText('2.3')).toBeInTheDocument();
    expect(screen.getByLabelText('Boundary')).toHaveValue('');
    expect(screen.getByLabelText('Looked after by')).toHaveValue('not-known');
    // The ghost cannot be removed — it is not part of the form value yet
    expect(
      screen.queryByRole('button', { name: 'Remove boundary feature 1' }),
    ).not.toBeInTheDocument();
  });

  it('should materialise the ghost row as a one-element array on the first keystroke', () => {
    // Arrange
    const onChange = vi.fn();
    const value = emptyTA6Form().section2;
    render(<Section02 value={value} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.change(screen.getByLabelText('Boundary'), { target: { value: 'left' } });

    // Assert — typing into the ghost writes through it, nothing fired before
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q2_1Features: [{ position: 'left', ownership: 'not-known' }],
    });
  });

  it('should not render a ghost boundary row when readOnly', () => {
    // Arrange / Act
    render(<Section02 value={emptyTA6Form().section2} onChange={() => {}} readOnly />);

    // Assert
    expect(screen.queryByLabelText('Boundary')).not.toBeInTheDocument();
  });

  it('should append a boundary feature row defaulting to not-known ownership when added', () => {
    // Arrange
    const onChange = vi.fn();
    const value = emptyTA6Form().section2;
    render(<Section02 value={value} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: /add boundary feature/i }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q2_1Features: [{ position: '', ownership: 'not-known' }],
    });
  });

  it('should call onChange with the selected ownership when a boundary row select changes', () => {
    // Arrange
    const onChange = vi.fn();
    const value = {
      ...emptyTA6Form().section2,
      q2_1Features: [{ position: 'left', ownership: 'not-known' as const }],
    };
    render(<Section02 value={value} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.change(screen.getByLabelText('Looked after by'), {
      target: { value: 'shared' },
    });

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q2_1Features: [{ position: 'left', ownership: 'shared' }],
    });
  });

  it('should map an emptied 2.2 description to null to mirror the on-chain optional', () => {
    // Arrange
    const onChange = vi.fn();
    const value = { ...emptyTA6Form().section2, q2_2IrregularDescription: 'See marked plan' };
    render(<Section02 value={value} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.change(screen.getByLabelText('2.2 description'), { target: { value: '' } });

    // Assert
    expect(onChange).toHaveBeenCalledWith({ ...value, q2_2IrregularDescription: null });
  });

  it('should call onChange with not-known when Not known is clicked on 2.3', () => {
    // Arrange
    const onChange = vi.fn();
    const value = emptyTA6Form().section2;
    render(<Section02 value={value} onChange={onChange} readOnly={false} />);
    const answerGroup = screen.getByRole('group', { name: '2.3 answer' });

    // Act
    fireEvent.click(within(answerGroup).getByRole('button', { name: 'Not known' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q2_3MovedOrAltered: { answer: 'not-known', details: '' },
    });
  });
});
